import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  api,
  OCCASIONS,
  type AddOn,
  type AvailabilityResponse,
  type CategoryCounts,
  type LocationT,
  type Occasion,
  type Platter,
  type SubscriptionFrequency,
} from "../lib/api";
import { loadCart, saveCart, clearCart, type Cart } from "../lib/cart";
import { computeTotals, feedsMid, roundTo5p } from "../lib/addOnPricing";
import { gbp, formatDate } from "../lib/format";
import { CapacityCalendar, daysInMonth, monthStart } from "../components/CapacityCalendar";
import { AddOnsStep } from "../components/AddOnsStep";
import { Header } from "../components/Header";
import { SubscribeSave } from "../components/SubscribeSave";
import { usePageTitle } from "../lib/title";
import { trackOrderRequest } from "../lib/consent";
import { bestBundleDiscount } from "../lib/bundle-discount";
import { collectionWindow } from "../lib/preorder";
import type { Bundle } from "../lib/api";

const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

type Step = "extras" | "details" | "review";
const STEPS: Step[] = ["extras", "details", "review"];
const STEP_LABELS: Record<Step, string> = { extras: "Extras", details: "Your details", review: "Review" };

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export default function Order() {
  usePageTitle("Your order");
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [cart, setCart] = useState<Cart | null>(null);
  const [catalogueReady, setCatalogueReady] = useState(false);
  const [boards, setBoards] = useState<Platter[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [locations, setLocations] = useState<LocationT[]>([]);
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [calMonth, setCalMonth] = useState(() => monthStart(new Date().toISOString().slice(0, 10)));
  const [counts, setCounts] = useState<CategoryCounts | null>(null);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [step, setStep] = useState<Step>("extras");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Details form
  const [locationId, setLocationId] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [occasion, setOccasion] = useState<Occasion | "">("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  // Subscribe & Save + gift-a-board
  const [subFreq, setSubFreq] = useState<SubscriptionFrequency | null>(null);
  const [isGift, setIsGift] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [giftMessage, setGiftMessage] = useState("");

  // Load catalogue + cart on mount.
  useEffect(() => {
    const c = loadCart();
    setCart(c ?? null);
    setOccasion((c?.occasion as Occasion) ?? "");
    setSubFreq(c?.subscription?.frequency ?? null);
    // Every active product, not just catering boards — the basket can hold hams and
    // Christmas lines too, and a line we can't resolve would silently drop out.
    Promise.all([api.platters(), api.addOns(), api.locations()])
      .then(([b, a, l]) => {
        setBoards(b);
        setAddOns(a);
        setLocations(l);
        setCatalogueReady(true);
        if (l[0]) setLocationId((prev) => prev || l[0].id);
      })
      .catch(() => setError("Couldn't load the menu. Please try again."));
    api.categories().then(setCounts).catch(() => setCounts(null));
    api.bundles().then(setBundles).catch(() => setBundles([]));
  }, []);

  // Keep the subscription choice on the cart (survives reloads / drawer re-entry).
  function setSubscription(freq: SubscriptionFrequency | null) {
    setSubFreq(freq);
    setCart((prev) => {
      const base: Cart = prev ?? { boards: [], addOns: [], headcount: 0, origin: "direct" };
      const merged: Cart = { ...base };
      if (freq) merged.subscription = { frequency: freq };
      else delete merged.subscription;
      saveCart(merged);
      return merged;
    });
  }

  const boardById = useMemo(() => new Map(boards.map((b) => [b.id, b])), [boards]);
  const cartProducts = useMemo(
    () => (cart?.boards ?? []).map((cb) => boardById.get(cb.platterId)).filter((b): b is Platter => !!b),
    [cart, boardById],
  );
  // Pre-order basket = shop products only (hams, Christmas lines): no headcount, no
  // catering slot, its own collection window. Pay in full when any line asks for it.
  const isPreorder = cartProducts.length > 0 && cartProducts.every((b) => b.kind === "product");
  const payInFull = cartProducts.some((b) => b.payInFull);
  const window_ = useMemo(() => collectionWindow(cartProducts), [cartProducts]);
  const extraLead = Math.max(0, ...cartProducts.map((b) => b.leadTimeHours ?? 0));

  // A ham-and-hamper basket has no use for the cutlery/plates step: start it on the
  // collection details (Back still reaches the extras). Once, so Back isn't overridden.
  const [skippedExtras, setSkippedExtras] = useState(false);
  useEffect(() => {
    if (!catalogueReady || skippedExtras || !isPreorder) return;
    setSkippedExtras(true);
    setStep((s) => (s === "extras" ? "details" : s));
  }, [catalogueReady, isPreorder, skippedExtras]);

  // Open the calendar on the first collectable month (e.g. December for Christmas lines).
  useEffect(() => {
    if (window_.from && window_.from > new Date().toISOString().slice(0, 10)) setCalMonth(monthStart(window_.from));
  }, [window_.from]);

  // Availability follows the chosen location AND the month on show, so paging the
  // calendar forward fetches that month rather than only ever the next three weeks.
  useEffect(() => {
    if (!locationId) return;
    setAvailability(null);
    let current = true;
    const today = new Date().toISOString().slice(0, 10);
    // Never ask for dates in the past; for the current month start from today.
    const from = calMonth.slice(0, 7) === today.slice(0, 7) ? today : calMonth;
    const span = daysInMonth(calMonth) - (Number(from.slice(8, 10)) - 1) + 1;
    api
      .availability(locationId, from, span, { preorder: isPreorder, leadHours: extraLead })
      .then((value) => {
        if (!current) return;
        // Dates outside the products' collection window can't be picked.
        setAvailability({
          ...value,
          days: value.days.map((d) =>
            (window_.from && d.date < window_.from) || (window_.to && d.date > window_.to)
              ? { ...d, status: "closed" as const, bookable: false }
              : d,
          ),
        });
      })
      .catch(() => { if (current) setAvailability(null); });
    return () => { current = false; };
  }, [locationId, calMonth, isPreorder, extraLead, window_.from, window_.to]);

  // Resolve cart lines to priced rows for display + totals.
  const boardLines = useMemo(
    () =>
      (cart?.boards ?? [])
        .map((cb) => {
          const b = boardById.get(cb.platterId);
          return b ? { board: b, quantity: cb.quantity, unitPrice: b.fixedPrice ?? 0 } : null;
        })
        .filter((x): x is { board: Platter; quantity: number; unitPrice: number } => !!x),
    [cart, boardById],
  );
  const addOnLines = useMemo(
    () =>
      (cart?.addOns ?? [])
        .map((ca) => {
          const a = addOns.find((x) => x.id === ca.addOnId);
          return a ? { addOn: a, quantity: ca.quantity, unitPrice: a.price } : null;
        })
        .filter((x): x is { addOn: AddOn; quantity: number; unitPrice: number } => !!x),
    [cart, addOns],
  );

  const totals = useMemo(
    () =>
      computeTotals(
        boardLines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity })),
        addOnLines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity })),
      ),
    [boardLines, addOnLines],
  );

  // Subscribe & Save display maths (server reprices authoritatively on submit). Mirrors
  // server money.ts: % off the subtotal first, then 25% deposit rounded to the nearest 5p.
  const subOn = counts?.subscribeSave !== false;
  // Subscribe & Save is for catering boards only — a basket with a pre-order product in it
  // never takes the discount, even if the customer subscribed to a board earlier.
  const hasProduct = cartProducts.some((b) => b.kind === "product");
  const activeSub = hasProduct ? null : subFreq;
  const subPct = activeSub && subOn ? counts?.subscribeSaveDiscountPct ?? 10 : 0;
  const bundleSaving = bestBundleDiscount(bundles, [
    ...boardLines.map((l) => ({ kind: "board", refId: l.board.id, quantity: l.quantity, price: l.unitPrice })),
    ...addOnLines.map((l) => ({ kind: "addon", refId: l.addOn.id, quantity: l.quantity, price: l.unitPrice })),
  ]);
  const subDiscount = subPct > 0 ? money(((totals.total - bundleSaving.amount) * subPct) / 100) : 0;
  const finalTotal = money(totals.total - bundleSaving.amount - subDiscount);
  const finalDeposit = payInFull ? finalTotal : roundTo5p(finalTotal * 0.25);
  const finalBalance = money(finalTotal - finalDeposit);
  const paymentsLive = counts?.paymentsLive === true;

  // Headcount used for add-on suggestions: the event headcount, or the boards' combined
  // feeds midpoint for a direct order.
  const suggestHeadcount = useMemo(() => {
    if (cart?.headcount && cart.headcount > 0) return cart.headcount;
    const fromFeeds = boardLines.reduce((s, l) => s + feedsMid(l.board) * l.quantity, 0);
    return Math.max(1, Math.round(fromFeeds));
  }, [cart, boardLines]);

  function update(next: Partial<Cart>) {
    setCart((prev) => {
      const base: Cart = prev ?? { boards: [], addOns: [], headcount: 0, origin: "direct" };
      const merged = { ...base, ...next };
      saveCart(merged);
      return merged;
    });
  }

  const setBoardQty = (platterId: string, quantity: number) => {
    const boardsNext = (cart?.boards ?? [])
      .map((b) => (b.platterId === platterId ? { ...b, quantity: Math.max(0, quantity) } : b))
      .filter((b) => b.quantity > 0);
    update({ boards: boardsNext });
  };

  const headcount = suggestHeadcount;
  const selectedDay = availability?.days.find((d) => d.date === date);

  const detailsValid =
    !!locationId && !!date && !!selectedDay?.bookable && name.trim().length > 0 && phone.trim().length >= 5 && emailOk(email);

  if (catalogueReady && boardLines.length === 0) {
    return (
      <div className="app order-page">
        <h1 className="page-h">Your order</h1>
        <p className="muted">Your order is empty.</p>
        <button className="btn" onClick={() => navigate("/platters")}>Browse boards</button>
        <button className="btn-ghost" onClick={() => navigate("/christmas")}>See the Christmas menu</button>
      </div>
    );
  }

  async function submit() {
    setError(null);
    if (!catalogueReady || boardLines.length === 0) {
      setError("Please add a board before placing your order.");
      return;
    }
    if (!detailsValid || !date) {
      setError("Please complete your details and pick a collection date.");
      setStep("details");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.createOrder({
        items: boardLines.map((l) => ({ platterId: l.board.id, quantity: l.quantity })),
        addOns: addOnLines.map((l) => ({ addOnId: l.addOn.id, quantity: l.quantity })),
        headcount,
        occasion: isPreorder ? undefined : occasion || undefined,
        collectionOrDeliveryDate: date,
        locationId,
        customerName: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        notes: notes.trim() || undefined,
        src: cart?.src || params.get("src") || undefined,
        isSubscription: activeSub ? true : undefined,
        subscriptionFrequency: activeSub || undefined,
        isGift: isGift || undefined,
        recipientName: isGift ? recipientName.trim() || undefined : undefined,
        giftMessage: isGift ? giftMessage.trim() || undefined : undefined,
      });
      clearCart();
      // Conversion signal for ad platforms — fired once here at placement (not on the
      // confirmation page, which is also reached via bookmark). No-ops without consent.
      trackOrderRequest({ value: res.order.total, ref: res.order.ref });
      // Live payments: off to Stripe's secure page; it brings them back to /confirm.
      if (res.checkoutUrl) {
        // Swap /order out of history first: pressing Back on Stripe's page then lands on
        // this order's "not paid yet — pay now" screen, not an empty basket.
        navigate(`/confirm/${res.order.ref}?cancelled=1`, { replace: true });
        window.location.assign(res.checkoutUrl);
        return;
      }
      navigate(`/confirm/${res.order.ref}`);
    } catch (e: any) {
      setError(e?.message || "Couldn't place your order. Please try again.");
      setSubmitting(false);
    }
  }

  const stepIdx = STEPS.indexOf(step);

  return (
    <div className="app order-page">
      <Header />
      <button className="link-back" onClick={() => navigate(isPreorder ? "/christmas" : "/platters")}>← Keep shopping</button>
      <h1 className="page-h">Your order</h1>

      {/* progress */}
      <ol className="steps-bar" aria-label="Order steps">
        {STEPS.map((s, i) => (
          <li key={s} className={`steps-dot${i === stepIdx ? " active" : ""}${i < stepIdx ? " done" : ""}`}>
            {STEP_LABELS[s]}
          </li>
        ))}
      </ol>

      {/* Always-visible board summary */}
      <section className="order-boards card">
        <h2 className="step-h">{isPreorder ? "Your order" : "Your boards"}</h2>
        {boardLines.map((l) => (
          <div key={l.board.id} className="order-line">
            <div>
              <span className="ol-name">{l.board.name}{l.board.variantLabel ? ` — ${l.board.variantLabel}` : ""}</span>
              {l.board.kind === "product"
                ? l.board.unitLabel && !l.board.variantLabel && <span className="muted ol-feeds"> · {l.board.unitLabel}</span>
                : l.board.serves && <span className="muted ol-feeds"> · feeds {l.board.serves}</span>}
            </div>
            <div className="stepper" role="group" aria-label={`${l.board.name} quantity`}>
              <button type="button" onClick={() => setBoardQty(l.board.id, l.quantity - 1)} aria-label="Decrease">−</button>
              <span className="stepper-val">{l.quantity}</span>
              <button type="button" onClick={() => setBoardQty(l.board.id, l.quantity + 1)} aria-label="Increase">+</button>
            </div>
            <span className="ol-price">{gbp(l.unitPrice * l.quantity)}</span>
          </div>
        ))}
        <button className="btn-ghost" onClick={() => navigate(isPreorder ? "/christmas" : "/platters")}>
          {isPreorder ? "+ Add something else" : "+ Add another board"}
        </button>
      </section>

      {step === "extras" && (
        <>
          <AddOnsStep addOns={addOns} headcount={headcount} value={cart?.addOns ?? []} onChange={(next) => update({ addOns: next })} />
          <RunningTotal total={finalTotal} deposit={finalDeposit} subDiscount={subDiscount} payInFull={payInFull} />
          <div className="step-actions">
            <button className="btn" onClick={() => setStep("details")}>Continue to details</button>
          </div>
        </>
      )}

      {step === "details" && (
        <section className="order-details">
          <h2 className="step-h">Collection & contact</h2>

          {!isPreorder && <label className="field">
            <span>How many people are you feeding?</span>
            <div className="stepper" role="group" aria-label="Headcount">
              <button type="button" onClick={() => update({ headcount: Math.max(1, headcount - 1) })} aria-label="Decrease">−</button>
              <input
                type="number"
                min={1}
                value={headcount}
                onChange={(e) => update({ headcount: Math.max(1, parseInt(e.target.value || "1", 10)) })}
                aria-label="Headcount"
              />
              <button type="button" onClick={() => update({ headcount: headcount + 1 })} aria-label="Increase">+</button>
            </div>
          </label>}

          <label className="field">
            <span>Collect from</span>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </label>

          <div className="field">
            <span>Collection date</span>
            <CapacityCalendar
              days={availability?.days ?? []}
              selected={date}
              onSelect={setDate}
              month={calMonth}
              onMonthChange={setCalMonth}
            />
            {!availability && <p className="muted">Loading dates…</p>}
            {window_.conflict ? (
              <p className="form-error" role="alert">
                These items can&apos;t be collected on the same day — please order them separately.
              </p>
            ) : window_.note && <p className="muted small">{window_.note}</p>}
          </div>

          {!isPreorder && <label className="field">
            <span>Occasion (optional)</span>
            <select value={occasion} onChange={(e) => setOccasion(e.target.value as Occasion | "")}>
              <option value="">—</option>
              {OCCASIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </label>}

          {subOn && !isPreorder && (
            <div className="field">
              <span>Make it a regular thing?</span>
              <SubscribeSave
                value={subFreq}
                onChange={setSubscription}
                discountPct={counts?.subscribeSaveDiscountPct ?? 10}
                invoiced={occasion === "Corporate"}
              />
            </div>
          )}

          <div className="field gift-toggle">
            <label className="gift-check">
              <input type="checkbox" checked={isGift} onChange={(e) => setIsGift(e.target.checked)} />
              <span>🎁 This is a gift — add a printed note</span>
            </label>
            {isGift && (
              <div className="gift-fields">
                <label className="field"><span>Who&apos;s it for?</span><input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Recipient's name" /></label>
                <label className="field"><span>Gift message (we&apos;ll print it and tuck it in)</span><textarea rows={2} maxLength={500} value={giftMessage} onChange={(e) => setGiftMessage(e.target.value)} placeholder="Happy birthday! Enjoy every bite x" /></label>
              </div>
            )}
          </div>

          <label className="field"><span>Your name</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
          <label className="field"><span>Phone</span><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" /></label>
          <label className="field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
          <label className="field"><span>{isPreorder ? "Notes — e.g. \"slice the ham, please\" (optional)" : "Allergies / notes (optional)"}</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></label>

          <RunningTotal total={finalTotal} deposit={finalDeposit} subDiscount={subDiscount} payInFull={payInFull} />
          <div className="step-actions">
            <button className="btn-ghost" onClick={() => setStep("extras")}>Back</button>
            <button className="btn" disabled={!detailsValid} onClick={() => setStep("review")}>Review order</button>
          </div>
        </section>
      )}

      {step === "review" && (
        <section className="order-review">
          <h2 className="step-h">Review & confirm</h2>
          <div className="card review-summary">
            {boardLines.map((l) => (
              <div key={l.board.id} className="review-row"><span>{l.quantity}× {l.board.name}{l.board.variantLabel ? ` — ${l.board.variantLabel}` : ""}</span><span>{gbp(l.unitPrice * l.quantity)}</span></div>
            ))}
            {addOnLines.map((l) => (
              <div key={l.addOn.id} className="review-row muted"><span>{l.quantity}× {l.addOn.name}</span><span>{gbp(l.unitPrice * l.quantity)}</span></div>
            ))}
            {bundleSaving.amount > 0 && <div className="review-row discount"><span>{bundleSaving.name} saving</span><span>−{gbp(bundleSaving.amount)}</span></div>}
            {subDiscount > 0 && (
              <>
                <div className="review-row muted"><span>Subtotal</span><span>{gbp(totals.total)}</span></div>
                <div className="review-row discount"><span>Subscribe &amp; save ({subPct}%)</span><span>−{gbp(subDiscount)}</span></div>
              </>
            )}
            <div className="review-row total"><span>{subDiscount > 0 ? "Total per delivery" : "Total"}</span><span>{gbp(finalTotal)}</span></div>
            {payInFull ? (
              <div className="review-row"><span>{paymentsLive ? "To pay now" : "To pay"}</span><span>{gbp(finalDeposit)}</span></div>
            ) : (
              <>
                <div className="review-row"><span>Deposit due (25%)</span><span>{gbp(finalDeposit)}</span></div>
                <div className="review-row"><span>Balance on collection</span><span>{gbp(finalBalance)}</span></div>
              </>
            )}
            {date && <div className="review-row muted"><span>{activeSub ? "First collection" : "Collection"}</span><span>{formatDate(date)}</span></div>}
            {isGift && recipientName.trim() && <div className="review-row muted"><span>Gift for</span><span>{recipientName.trim()}</span></div>}
          </div>

          {activeSub ? (
            <p className="deposit-policy recurring-note">
              <strong>You&apos;re setting up a {activeSub} board.</strong> {paymentsLive ? "Only your first board's deposit is taken today" : "No card is taken now"} and nothing bills
              automatically — we&apos;ll get in touch to set your schedule up with you and confirm each delivery before we
              make it. The 25% deposit confirms your first board; pause, skip or cancel any time.
            </p>
          ) : payInFull ? (
            <p className="deposit-policy">
              {paymentsLive
                ? "You'll pay securely by card, Apple Pay or Google Pay on the next screen. Once it's paid, your order is confirmed and set aside for you."
                : "We'll send you a secure payment link to confirm your order."}{" "}
              Need to change something? Just ring the shop.
            </p>
          ) : (
            <p className="deposit-policy">
              A 25% deposit confirms your order. Deposits are fully refundable up to 48 hours before collection.
              {paymentsLive && " You'll pay it securely on the next screen."}
            </p>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="step-actions">
            <button className="btn-ghost" onClick={() => setStep("details")}>Back</button>
            <button className="btn" disabled={submitting} onClick={submit}>
              {submitting ? (paymentsLive ? "Taking you to payment…" : "Placing…") : paymentsLive ? `Pay ${gbp(finalDeposit)} securely` : "Place order request"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function RunningTotal({ total, deposit, subDiscount = 0, payInFull = false }: { total: number; deposit: number; subDiscount?: number; payInFull?: boolean }) {
  return (
    <div className="running-total">
      <div>
        <span className="muted">Order total</span> <strong>{gbp(total)}</strong>
        {subDiscount > 0 && <span className="rt-saved"> · you save {gbp(subDiscount)}</span>}
      </div>
      <div className="muted small">{payInFull ? "Paid in full when you order" : `25% deposit to confirm: ${gbp(deposit)}`}</div>
    </div>
  );
}

