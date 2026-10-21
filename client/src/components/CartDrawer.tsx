import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, type AddOn, type Bundle, type CategoryCounts, type Platter } from "../lib/api";
import { emptyCart, loadCart, saveCart, type Cart } from "../lib/cart";
import { computeTotals, roundTo5p } from "../lib/addOnPricing";
import { bestBundleDiscount } from "../lib/bundle-discount";
import { gbp } from "../lib/format";
import { DeliVideos } from "./DeliVideos";
import { trackShoppingEvent } from "../lib/consent";
import { collectionWindow } from "../lib/preorder";

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
    // All products, not only catering boards — hams and Christmas lines live in the basket too.
    api.platters().then(setBoards).catch(() => setBoards([]));
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

  /* "Feeds around 18–24 people" — the question every grazing-board customer is
   * actually asking, answered before they reach the deposit. Shown only when every
   * board in the basket has a printed range, so the number is never a guess. */
  const feedsKnown = lines.length > 0 && lines.every(({ p }) => p.feedsMin != null && p.feedsMax != null);
  const feedsMin = feedsKnown ? lines.reduce((s, { b, p }) => s + (p.feedsMin ?? 0) * b.quantity, 0) : 0;
  const feedsMax = feedsKnown ? lines.reduce((s, { b, p }) => s + (p.feedsMax ?? 0) * b.quantity, 0) : 0;

  const bundleSaving = bestBundleDiscount(bundles, [
    ...lines.map(({ b, p }) => ({ kind: "board", refId: p.id, quantity: b.quantity, price: p.fixedPrice ?? p.fromPrice ?? 0 })),
    ...addOnLines.map(({ a, d }) => ({ kind: "addon", refId: d.id, quantity: a.quantity, price: d.price })),
  ]);
  // Subscribe & Save never applies to a basket holding a pre-order product (mirrors checkout).
  const hasProduct = lines.some(({ p }) => p.kind === "product");
  const subscriptionPct = cart.subscription && !hasProduct && content?.subscribeSave !== false ? Math.min(100, Math.max(0, content?.subscribeSaveDiscountPct ?? 10)) : 0;
  const subscriptionSaving = Math.round((totals.total - bundleSaving.amount) * subscriptionPct) / 100;
  const basketTotal = Math.round((totals.total - bundleSaving.amount - subscriptionSaving) * 100) / 100;
  // Split the money into the two moments the customer cares about: today, and on the day.
  // Pay-in-full lines (supplier-sourced/Christmas stock) take the whole total today.
  const payInFull = lines.some(({ p }) => p.payInFull);
  const deposit = payInFull ? basketTotal : roundTo5p(basketTotal * .25);
  const balance = Math.round((basketTotal - deposit) * 100) / 100;
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
  /* Empty-basket rescue: an empty drawer is a dead end, so offer a way back in.
   * Owner's own recommend order, one tile per product — sizes share a variantGroup
   * and are chosen on the product page, so these link through rather than add. */
  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    // Catering boards only — the catalogue now also holds per-head legacy platters and
    // Christmas lines, which aren't the "start here" picks.
    return boards
      .filter((b) => b.category === "board")
      .filter((b) => { const key = b.variantGroup ?? b.id; if (seen.has(key)) return false; seen.add(key); return true; })
      .sort((a, b) => (b.recommendPriority - a.recommendPriority) || (a.sortOrder - b.sortOrder))
      .slice(0, 3);
  }, [boards]);

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

  // Pre-order products set the collection window; boards just need the notice period.
  const products = lines.filter(({ p }) => p.kind === "product").map(({ p }) => p);
  const collect = products.length ? collectionWindow(products) : null;
  const paymentsLive = content?.paymentsLive === true;
  // Extras sold per person (plates for 20) count once, so the badge reads like the basket looks.
  const itemCount = lines.reduce((n, l) => n + l.b.quantity, 0) + addOnLines.length;

  return (
    <div className="drawer-root bk-root">
      <button className="bk-overlay" aria-label="Close basket" onClick={close} />
      <aside ref={drawerRef} className="bk" role="dialog" aria-modal="true" aria-label="Your basket">
        <div className="bk-head">
          <div>
            <h2 className="bk-title">Your basket</h2>
            {itemCount > 0 && <p className="bk-count">{itemCount} {itemCount === 1 ? "item" : "items"}</p>}
          </div>
          <button ref={closeRef} className="bk-close" onClick={close} aria-label="Close basket">
            <span aria-hidden="true">Close</span>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.3" /></svg>
          </button>
        </div>

        <div className="bk-body">
          {lines.length === 0 && (
            <div className="bk-empty">
              <p className="bk-empty-lead">Your basket is empty.</p>
              <p className="bk-empty-sub">Start with a board, or have a look at what else the shop makes.</p>
              {suggestions.length > 0 && (
                <>
                  <p className="bk-label">Start with one of these</p>
                  <ul className="bk-suggests">
                    {suggestions.map((s) => (
                      <li key={s.id}>
                        <Link className="bk-suggest" to={`/platter/${encodeURIComponent(s.id)}`} onClick={close}>
                          <Thumb name={s.name} imageUrl={s.imageUrl} />
                          <span className="bk-line-info">
                            <span className="bk-name">{s.name}</span>
                            <span className="bk-meta">
                              {s.fixedPrice != null ? gbp(s.fixedPrice) : `From ${gbp(s.fromPrice)}`}
                              {s.serves ? `, feeds ${s.serves}` : ""}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div className="bk-empty-links">
                <Link to="/platters" onClick={close}>All boards</Link>
                {content?.season !== "classic" && <Link to="/christmas" onClick={close}>Christmas menu</Link>}
                <Link to="/bread" onClick={close}>Fresh bread</Link>
              </div>
            </div>
          )}

          {feedsKnown && feedsMax > 0 && (
            <p className="bk-feeds" role="status">
              Feeds around <strong>{feedsMin === feedsMax ? feedsMin : `${feedsMin}–${feedsMax}`}</strong> people
            </p>
          )}

          {lines.length > 0 && giftOn && (
            <div className={`bk-gift${giftUnlocked ? " unlocked" : ""}`} role="status">
              <p className="bk-gift-text">
                {giftUnlocked
                  ? <>You&apos;ve earned a free {content!.freeGiftText} — we&apos;ll add it to your order.</>
                  : <>Spend <strong>{gbp(giftRemaining)}</strong> more for a free {content!.freeGiftText}</>}
              </p>
              <div className="bk-gift-track" aria-hidden="true">
                <div className="bk-gift-fill" style={{ width: `${giftPct}%` }} />
              </div>
            </div>
          )}

          {(lines.length > 0 || addOnLines.length > 0) && (
            <ul className="bk-lines">
              {lines.map(({ b, p }) => (
                <li className="bk-line" key={b.platterId}>
                  <Thumb name={p.name} imageUrl={p.imageUrl} />
                  <div className="bk-line-info">
                    <span className="bk-name">{p.name}</span>
                    {(p.variantLabel || p.unitLabel || p.serves) && (
                      <span className="bk-meta">
                        {p.kind === "product" ? (p.variantLabel ?? p.unitLabel ?? "") : p.variantLabel ?? (p.serves ? `Feeds ${p.serves}` : "")}
                      </span>
                    )}
                    {p.kind === "product" && <span className="bk-tag">{p.payInFull ? "Pre-order, paid in full" : "Pre-order"}</span>}
                    <div className="bk-row">
                      <div className="bk-stepper stepper">
                        <button onClick={() => setBoardQty(b.platterId, b.quantity - 1)} aria-label={`One fewer ${p.name}`}>−</button>
                        <span className="stepper-val" aria-live="polite">{b.quantity}</span>
                        <button onClick={() => setBoardQty(b.platterId, b.quantity + 1)} aria-label={`One more ${p.name}`}>+</button>
                      </div>
                      <span className="bk-price">{gbp((p.fixedPrice ?? p.fromPrice ?? 0) * b.quantity)}</span>
                    </div>
                  </div>
                </li>
              ))}

              {addOnLines.map(({ a, d }) => (
                <li className="bk-line is-extra" key={a.addOnId}>
                  <Thumb name={d.name} imageUrl={d.imageUrl} monogram />
                  <div className="bk-line-info">
                    <span className="bk-name">{d.name}</span>
                    {d.unitLabel && <span className="bk-meta">{gbp(d.price)} {d.unitLabel}</span>}
                    <div className="bk-row">
                      <div className="bk-stepper stepper">
                        <button onClick={() => setAddOnQty(a.addOnId, a.quantity - 1)} aria-label={`One fewer ${d.name}`}>−</button>
                        <span className="stepper-val" aria-live="polite">{a.quantity}</span>
                        <button onClick={() => setAddOnQty(a.addOnId, a.quantity + 1)} aria-label={`One more ${d.name}`}>+</button>
                      </div>
                      <span className="bk-price">{gbp(d.price * a.quantity)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {lines.length > 0 && completeOffer && <section className="bk-bundle">
            <p className="eyebrow">Make it a complete spread</p><h3 className="bk-bundle-h">{completeOffer.bundle.name}</h3>
            <p>Add {completeOffer.missing.map((i) => `${i.quantity}× ${i.name}`).join(", ")} to unlock {gbp(completeOffer.bundle.saving)} bundle savings.</p>
            <button type="button" className="btn btn-secondary" onClick={completeBundle}>Add missing items, {gbp(completeOffer.missing.reduce((sum, i) => sum + i.quantity * i.price, 0))}</button>
            <p className="bk-fine">Item price shown before the bundle saving. Your total updates below.</p>
          </section>}

          {lines.length > 0 && upsells.length > 0 && (
            <section className="bk-upsells" aria-label="Goes well with">
              <p className="bk-label">Goes well with</p>
              <ul>
                {upsells.map((u) => (
                  <li className="bk-upsell" key={u.id}>
                    <div className="bk-line-info">
                      <span className="bk-upsell-name">{u.name}</span>
                      <span className="bk-meta">{gbp(u.price)}{u.unitLabel ? ` ${u.unitLabel}` : ""}</span>
                    </div>
                    <button className="bk-add" aria-label={`Add ${u.name}`} onClick={() => { setAddOnQty(u.id, 1); trackShoppingEvent("basket_extra_added", { item_id: u.id, value: u.price }); }}>+ Add</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {lines.length > 0 && <DeliVideos productIds={lines.map((l) => l.p.id)} fill compact onProductNavigate={close} />}
        </div>

        {lines.length > 0 && (
          <div className="drawer-foot bk-foot">
            <div className="bk-sums">
              {(bundleSaving.amount > 0 || subscriptionSaving > 0) && <div className="bk-sum muted"><span>Subtotal</span><span>{gbp(totals.total)}</span></div>}
              {bundleSaving.amount > 0 && <div className="bk-sum is-saving bundle-saving" role="status"><span>{bundleSaving.name} saving</span><span>−{gbp(bundleSaving.amount)}</span></div>}
              {subscriptionSaving > 0 && <div className="bk-sum is-saving"><span>Subscribe &amp; save ({subscriptionPct}%)</span><span>−{gbp(subscriptionSaving)}</span></div>}
              <div className="bk-sum is-total"><span>{subscriptionSaving > 0 ? "Total per delivery" : "Total"}</span><strong>{gbp(basketTotal)}</strong></div>
            </div>
            <div className="bk-split">
              <div className="bk-split-col is-now">
                <span className="bk-split-k">{payInFull ? (paymentsLive ? "Pay today, in full" : "To pay, in full") : (paymentsLive ? "Pay today (25% deposit)" : "To confirm (25% deposit)")}</span>
                <strong className="bk-split-v">{gbp(deposit)}</strong>
              </div>
              <div className="bk-split-col">
                <span className="bk-split-k">On collection</span>
                {payInFull
                  ? <span className="bk-split-v is-none">Nothing to pay</span>
                  : <strong className="bk-split-v">{gbp(balance)}</strong>}
              </div>
            </div>
            <button className="btn bk-go" onClick={checkout}>Continue — choose collection day</button>
            <p className="bk-reassure">
              {payInFull
                ? paymentsLive ? "Paid up front, so your order is set aside and you skip the queue." : "We'll send a secure payment link to confirm — then it's set aside with your name on it."
                : "Deposit is fully refundable up to 48 hours before collection."}
              {" "}{collect?.conflict
                ? "Some items here have different collection dates — we'll help you sort it at the next step."
                : collect?.note ?? "Collect from the deli on the day you choose."}
            </p>
            <button className="bk-keep" onClick={close}>Keep browsing</button>
          </div>
        )}
      </aside>
    </div>
  );
}

/** Small thumbnail: the owner's photo, a letter for extras, or a plain counter-colour block. */
function Thumb({ name, imageUrl, monogram = false }: { name: string; imageUrl: string | null; monogram?: boolean }) {
  if (imageUrl) return <span className="bk-thumb" style={{ backgroundImage: `url(${imageUrl})` }} aria-hidden="true" />;
  if (monogram) return <span className="bk-thumb is-mono" aria-hidden="true">{name.charAt(0)}</span>;
  return <span className="bk-thumb is-blank" aria-hidden="true" />;
}
