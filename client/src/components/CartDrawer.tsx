import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, type AddOn, type Bundle, type CategoryCounts, type Platter } from "../lib/api";
import { emptyCart, loadCart, saveCart, type Cart } from "../lib/cart";
import { computeTotals, roundTo5p } from "../lib/addOnPricing";
import { bestBundleDiscount } from "../lib/bundle-discount";
import { gbp } from "../lib/format";
import { DeliVideos } from "./DeliVideos";
import { trackShoppingEvent } from "../lib/consent";

/* Smart Cart — the slide-over basket the big DTC stores run as a paid app.
 * Opens on add-to-order, shows the boards with steppers, one-tap add-on upsells
 * ("pairs well with"), live total + deposit maths, and a single checkout CTA.
 * Everything reads/writes the same kd-cart the order flow uses, so checkout
 * continuity is free. Open it from anywhere with openCartDrawer(). */

const OPEN_EVENT = "kd:cart-open";
export const CART_CHANGED_EVENT = "kd:cart-changed";

export function openCartDrawer() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

function notifyCartChanged() {
  window.dispatchEvent(new CustomEvent(CART_CHANGED_EVENT));
}

export function CartDrawer() {
  const [open, setOpen] = useState(false);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [cart, setCart] = useState<Cart>(() => loadCart() ?? emptyCart());
  const [boards, setBoards] = useState<Platter[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [content, setContent] = useState<CategoryCounts | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => { setOpen(false); }, [location.pathname]);

  useEffect(() => {
    const onOpen = () => {
      openerRef.current = (document.activeElement as HTMLElement) ?? null;
      setCart(loadCart() ?? emptyCart());
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  // Catalogue for names/prices/upsells — fetched once, on first open.
  useEffect(() => {
    if (!open || boards.length > 0) return;
    api.boards().then(setBoards).catch(() => setBoards([]));
    api.addOns().then((a) => setAddOns(a.filter((x) => x.active))).catch(() => setAddOns([]));
    api.categories().then(setContent).catch(() => setContent(null));
    api.bundles().then(setBundles).catch(() => setBundles([]));
  }, [open, boards.length]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key !== "Tab") return;
      const nodes = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), video[controls]') ?? []);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    openerRef.current?.focus?.();
  }, []);

  const update = (next: Cart) => {
    setCart(next);
    saveCart(next);
    notifyCartChanged();
  };

  const boardById = useMemo(() => new Map(boards.map((b) => [b.id, b])), [boards]);
  const addOnById = useMemo(() => new Map(addOns.map((a) => [a.id, a])), [addOns]);

  const setBoardQty = (platterId: string, qty: number) => {
    const next = { ...cart, boards: cart.boards.map((b) => (b.platterId === platterId ? { ...b, quantity: qty } : b)).filter((b) => b.quantity > 0) };
    update(next);
  };
  const setAddOnQty = (addOnId: string, qty: number) => {
    const has = cart.addOns.some((a) => a.addOnId === addOnId);
    const nextAddOns = has
      ? cart.addOns.map((a) => (a.addOnId === addOnId ? { ...a, quantity: qty } : a)).filter((a) => a.quantity > 0)
      : qty > 0
        ? [...cart.addOns, { addOnId, quantity: qty }]
        : cart.addOns;
    update({ ...cart, addOns: nextAddOns });
  };

  const lines = cart.boards
    .map((b) => ({ b, p: boardById.get(b.platterId) }))
    .filter((x): x is { b: Cart["boards"][number]; p: Platter } => !!x.p);
  const addOnLines = cart.addOns
    .map((a) => ({ a, d: addOnById.get(a.addOnId) }))
    .filter((x): x is { a: Cart["addOns"][number]; d: AddOn } => !!x.d);

  const totals = computeTotals(
    lines.map((l) => ({ unitPrice: l.p.fixedPrice ?? l.p.fromPrice ?? 0, quantity: l.b.quantity })),
    addOnLines.map((l) => ({ unitPrice: l.d.price, quantity: l.a.quantity })),
  );

  const bundleSaving = bestBundleDiscount(bundles, [
    ...lines.map(({ b, p }) => ({ kind: "board", refId: p.id, quantity: b.quantity, price: p.fixedPrice ?? p.fromPrice ?? 0 })),
    ...addOnLines.map(({ a, d }) => ({ kind: "addon", refId: d.id, quantity: a.quantity, price: d.price })),
  ]);
  const subscriptionPct = cart.subscription && content?.subscribeSave !== false ? Math.min(100, Math.max(0, content?.subscribeSaveDiscountPct ?? 10)) : 0;
  const subscriptionSaving = Math.round((totals.total - bundleSaving.amount) * subscriptionPct) / 100;
  const basketTotal = Math.round((totals.total - bundleSaving.amount - subscriptionSaving) * 100) / 100;
  const completeOffer = bundles.filter((b) => b.saving > bundleSaving.amount).map((b) => {
    const missing = b.items.map((it) => {
      const quantity = it.kind === "board" ? cart.boards.find((x) => x.platterId === it.refId)?.quantity ?? 0 : cart.addOns.find((x) => x.addOnId === it.refId)?.quantity ?? 0;
      return { ...it, quantity: Math.max(0, it.quantity - quantity) };
    });
    const partlyPresent = missing.some((it, i) => it.quantity < b.items[i].quantity);
    return { bundle: b, missing: missing.filter((it) => it.quantity > 0), partlyPresent };
  }).filter((x) => x.partlyPresent && x.missing.length > 0).sort((a, b) => b.bundle.saving - a.bundle.saving)[0];
  const completeBundle = () => {
    if (!completeOffer) return;
    trackShoppingEvent("bundle_completed", { item_id: completeOffer.bundle.id });
    const next = { ...cart, boards: cart.boards.map((b) => ({ ...b })), addOns: cart.addOns.map((a) => ({ ...a })) };
    for (const it of completeOffer.missing) {
      if (it.kind === "board") {
        const row = next.boards.find((b) => b.platterId === it.refId);
        if (row) row.quantity += it.quantity; else next.boards.push({ platterId: it.refId, quantity: it.quantity });
      } else {
        const row = next.addOns.find((a) => a.addOnId === it.refId);
        if (row) row.quantity += it.quantity; else next.addOns.push({ addOnId: it.refId, quantity: it.quantity });
      }
    }
    update(next);
  };
  // Upsells: active add-ons not yet in the basket, in admin sort order, capped at 4.
  const upsells = addOns.filter((a) => !cart.addOns.some((c) => c.addOnId === a.id)).slice(0, 4);

  // "Spend £X, get a free treat" progress. Only when the owner has switched it on with a
  // threshold + reward. The gift is added at no charge on the server — this is the nudge.
  const giftOn = !!content?.freeGift && content.freeGiftThreshold > 0 && !!content.freeGiftText;
  const giftRemaining = giftOn ? Math.max(0, content!.freeGiftThreshold - totals.total) : 0;
  const giftUnlocked = giftOn && totals.total >= content!.freeGiftThreshold;
  const giftPct = giftOn ? Math.min(100, Math.round((totals.total / content!.freeGiftThreshold) * 100)) : 0;

  const checkout = () => {
    close();
    navigate("/order");
  };

  if (!open) return null;

  return (
    <div className="drawer-root">
      <button className="drawer-overlay" aria-label="Close basket" onClick={close} />
      <aside ref={drawerRef} className="drawer" role="dialog" aria-modal="true" aria-label="Your basket">
        <div className="drawer-head">
          <h2 className="drawer-h">Your basket</h2>
          <button ref={closeRef} className="drawer-close" onClick={close} aria-label="Close basket">×</button>
        </div>

        <div className="drawer-body">
          {lines.length === 0 && <p className="muted">Your basket is empty — add a board to get started.</p>}

          {lines.length > 0 && giftOn && (
            <div className={`gift-bar${giftUnlocked ? " unlocked" : ""}`} role="status">
              <p className="gift-bar-text">
                {giftUnlocked
                  ? <>🎉 Nice one — you&apos;ve earned a free {content!.freeGiftText}!</>
                  : <>Spend <strong>{gbp(giftRemaining)}</strong> more for a free {content!.freeGiftText}</>}
              </p>
              <div className="gift-bar-track" aria-hidden="true">
                <div className="gift-bar-fill" style={{ width: `${giftPct}%` }} />
              </div>
            </div>
          )}

          {lines.map(({ b, p }) => (
            <div className="drawer-line" key={b.platterId}>
              {p.imageUrl && <div className="drawer-thumb" style={{ backgroundImage: `url(${p.imageUrl})` }} aria-hidden="true" />}
              <div className="drawer-line-info">
                <span className="drawer-line-name">{p.name}</span>
                <span className="muted small">{p.serves ? `Feeds ${p.serves}` : ""}</span>
                <div className="stepper">
                  <button onClick={() => setBoardQty(b.platterId, b.quantity - 1)} aria-label={`One fewer ${p.name}`}>−</button>
                  <span className="stepper-val">{b.quantity}</span>
                  <button onClick={() => setBoardQty(b.platterId, b.quantity + 1)} aria-label={`One more ${p.name}`}>+</button>
                </div>
              </div>
              <span className="drawer-line-price">{gbp((p.fixedPrice ?? p.fromPrice ?? 0) * b.quantity)}</span>
            </div>
          ))}

          {addOnLines.map(({ a, d }) => (
            <div className="drawer-line" key={a.addOnId}>
              {d.imageUrl && <div className="drawer-thumb" style={{ backgroundImage: `url(${d.imageUrl})` }} aria-hidden="true" />}
              <div className="drawer-line-info">
                <span className="drawer-line-name">{d.name}</span>
                <div className="stepper">
                  <button onClick={() => setAddOnQty(a.addOnId, a.quantity - 1)} aria-label={`One fewer ${d.name}`}>−</button>
                  <span className="stepper-val">{a.quantity}</span>
                  <button onClick={() => setAddOnQty(a.addOnId, a.quantity + 1)} aria-label={`One more ${d.name}`}>+</button>
                </div>
              </div>
              <span className="drawer-line-price">{gbp(d.price * a.quantity)}</span>
            </div>
          ))}

          {lines.length > 0 && completeOffer && <section className="drawer-bundle-offer">
            <p className="deli-eyebrow">Make it a complete spread</p><h3>{completeOffer.bundle.name}</h3>
            <p>Add {completeOffer.missing.map((i) => `${i.quantity}× ${i.name}`).join(", ")} to unlock {gbp(completeOffer.bundle.saving)} bundle savings.</p>
            <button type="button" className="btn" onClick={completeBundle}>Add missing items · {gbp(completeOffer.missing.reduce((sum, i) => sum + i.quantity * i.price, 0))}</button>
            <p className="muted small">Item price shown before the bundle saving. Your total updates below.</p>
          </section>}
          {lines.length > 0 && upsells.length > 0 && (
            <div className="drawer-upsells">
              <p className="drawer-upsell-h">Goes well with</p>
              {upsells.map((u) => (
                <div className="drawer-upsell" key={u.id}>
                  {u.imageUrl && <div className="drawer-thumb sm" style={{ backgroundImage: `url(${u.imageUrl})` }} aria-hidden="true" />}
                  <div className="drawer-line-info">
                    <span className="drawer-line-name">{u.name}</span>
                    <span className="muted small">{gbp(u.price)}{u.unitLabel ? ` · ${u.unitLabel}` : ""}</span>
                  </div>
                  <button className="drawer-add" onClick={() => { setAddOnQty(u.id, 1); trackShoppingEvent("basket_extra_added", { item_id: u.id, value: u.price }); }}>Add</button>
                </div>
              ))}
            </div>
          )}
          {lines.length > 0 && <DeliVideos productId={lines[0].p.id} compact onProductNavigate={close} />}
        </div>

        {lines.length > 0 && (
          <div className="drawer-foot">
            {bundleSaving.amount > 0 && <div className="spread bundle-saving" role="status"><span>{bundleSaving.name} saving</span><span>−{gbp(bundleSaving.amount)}</span></div>}
            {subscriptionSaving > 0 && <div className="spread"><span>Subscribe &amp; save ({subscriptionPct}%)</span><span>−{gbp(subscriptionSaving)}</span></div>}
            <div className="spread"><span className="muted">{subscriptionSaving > 0 ? "Total per delivery" : "Total"}</span><strong>{gbp(basketTotal)}</strong></div>
            <div className="spread small muted"><span>25% deposit to confirm</span><span>{gbp(roundTo5p(basketTotal * .25))}</span></div>
            <button className="btn" onClick={checkout}>Continue — choose collection day</button>
            <button className="btn-ghost drawer-keep" onClick={close}>Keep browsing</button>
          </div>
        )}
      </aside>
    </div>
  );
}
