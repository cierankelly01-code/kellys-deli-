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
import { CapacityCalendar } from "../components/CapacityCalendar";
import { AddOnsStep } from "../components/AddOnsStep";
import { Header } from "../components/Header";
import { SubscribeSave } from "../components/SubscribeSave";
import { usePageTitle } from "../lib/title";
import { trackOrderRequest } from "../lib/consent";

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
  const [boards, setBoards] = useState<Platter[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [locations, setLocations] = useState<LocationT[]>([]);
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [counts, setCounts] = useState<CategoryCounts | null>(null);
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
    Promise.all([api.boards(), api.addOns(), api.locations()])
      .then(([b, a, l]) => {
        setBoards(b);
        setAddOns(a);
        setLocations(l);
        if (l[0]) setLocationId((prev) => prev || l[0].id);
      })
      .catch(() => setError("Couldn't load the menu. Please try again."));
    api.categories().then(setCounts).catch(() => setCounts(null));
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

  // Availability follows the chosen location.
  useEffect(() => {
    if (!locationId) return;
    setAvailability(null);
    api.availability(locationId).then(setAvailability).catch(() => setAvailability(null));
  }, [locationId]);

  const boardById = useMemo(() => new Map(boards.map((b) => [b.id, b])), [boards]);

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
  const subPct = subFreq && subOn ? counts?.subscribeSaveDiscountPct ?? 10 : 0;
  const subDiscount = subPct > 0 ? money((totals.total * subPct) / 100) : 0;
  const finalTotal = money(totals.total - subDiscount);
  const finalDeposit = subPct > 0 ? roundTo5p(finalTotal * 0.25) : totals.deposit;
  const finalBalance = money(finalTotal - finalDeposit);

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

  if (cart && boardLines.length === 0 && boards.length > 0) {
    return (
      <div className="app order-page">
        <h1 className="page-h">Your order</h1>
        <p className="muted">Your order is empty.</p>
        <button className="btn" onClick={() => navigate("/platters")}>Browse boards</button>
      </div>
    );
  }

  async function submit() {
    setError(null);
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
        occasion: occasion || undefined,
        collectionOrDeliveryDate: date,
        locationId,
        customerName: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        notes: notes.trim() || undefined,
        src: cart?.src || params.get("src") || undefined,
        isSubscription: subFreq ? true : undefined,
        subscriptionFrequency: subFreq || undefined,
        isGift: isGift || undefined,
        recipientName: isGift ? recipientName.trim() || undefined : undefined,
        giftMessage: isGift ? giftMessage.trim() || undefined : undefined,
      });
      clearCart();
      // Conversion signal for ad platforms — fired once here at placement (not on the
      // confirmation page, which is also reached via bookmark). No-ops without consent.
      trackOrderRequest({ value: res.order.total, ref: res.order.ref });
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
      <button className="link-back" onClick={() => navigate("/platters")}>← Keep shopping</button>
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
        <h2 className="step-h">Your boards</h2>
        {boardLines.map((l) => (
          <div key={l.board.id} className="order-line">
            <div>
              <span className="ol-name">{l.board.name}</span>
              {l.board.serves && <span className="muted ol-feeds"> · feeds {l.board.serves}</span>}
            </div>
            <div className="stepper" role="group" aria-label={`${l.board.name} quantity`}>
              <button type="button" onClick={() => setBoardQty(l.board.id, l.quantity - 1)} aria-label="Decrease">−</button>
              <span className="stepper-val">{l.quantity}</span>
              <button type="button" onClick={() => setBoardQty(l.board.id, l.quantity + 1)} aria-label="Increase">+</button>
            </div>
            <span className="ol-price">{gbp(l.unitPrice * l.quantity)}</span>
          </div>
        ))}
        <button className="btn-ghost" onClick={() => navigate("/platters")}>+ Add another board</button>
      </section>

      {step === "extras" && (
        <>
          <AddOnsStep addOns={addOns} headcount={headcount} value={cart?.addOns ?? []} onChange={(next) => update({ addOns: next })} />
          <RunningTotal total={finalTotal} deposit={finalDeposit} subDiscount={subDiscount} />
          <div className="step-actions">
            <button className="btn" onClick={() => setStep("details")}>Continue to details</button>
          </div>
        </>
      )}

      {step === "details" && (
        <section className="order-details">
          <h2 className="step-h">Collection & contact</h2>

          <label className="field">
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
          </label>

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
            {availability ? (
              <CapacityCalendar days={availability.days} selected={date} onSelect={setDate} />
            ) : (
              <p className="muted">Loading dates…</p>
            )}
          </div>

          <label className="field">
            <span>Occasion (optional)</span>
            <select value={occasion} onChange={(e) => setOccasion(e.target.value as Occasion | "")}>
              <option value="">—</option>
              {OCCASIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </label>

          {subOn && (
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
          <label className="field"><span>Allergies / notes (optional)</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></label>

          <RunningTotal total={finalTotal} deposit={finalDeposit} subDiscount={subDiscount} />
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
              <div key={l.board.id} className="review-row"><span>{l.quantity}× {l.board.name}</span><span>{gbp(l.unitPrice * l.quantity)}</span></div>
            ))}
            {addOnLines.map((l) => (
              <div key={l.addOn.id} className="review-row muted"><span>{l.quantity}× {l.addOn.name}</span><span>{gbp(l.unitPrice * l.quantity)}</span></div>
            ))}
            {subDiscount > 0 && (
              <>
                <div className="review-row muted"><span>Subtotal</span><span>{gbp(totals.total)}</span></div>
                <div className="review-row discount"><span>Subscribe &amp; save ({subPct}%)</span><span>−{gbp(subDiscount)}</span></div>
              </>
            )}
            <div className="review-row total"><span>{subDiscount > 0 ? "Total per delivery" : "Total"}</span><span>{gbp(finalTotal)}</span></div>
            <div className="review-row"><span>Deposit due (25%)</span><span>{gbp(finalDeposit)}</span></div>
            <div className="review-row"><span>Balance on collection</span><span>{gbp(finalBalance)}</span></div>
            {date && <div className="review-row muted"><span>{subFreq ? "First collection" : "Collection"}</span><span>{formatDate(date)}</span></div>}
            {isGift && recipientName.trim() && <div className="review-row muted"><span>Gift for</span><span>{recipientName.trim()}</span></div>}
          </div>

          {subFreq ? (
            <p className="deposit-policy recurring-note">
              <strong>You&apos;re setting up a {subFreq} board.</strong> No card is taken now and nothing bills
              automatically — we&apos;ll get in touch to set your schedule up with you and confirm each delivery before we
              make it. The 25% deposit confirms your first board; pause, skip or cancel any time.
            </p>
          ) : (
            <p className="deposit-policy">
              A 25% deposit confirms your order. Deposits are fully refundable up to 48 hours before collection.
            </p>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="step-actions">
            <button className="btn-ghost" onClick={() => setStep("details")}>Back</button>
            <button className="btn" disabled={submitting} onClick={submit}>
              {submitting ? "Placing…" : "Place order request"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function RunningTotal({ total, deposit, subDiscount = 0 }: { total: number; deposit: number; subDiscount?: number }) {
  return (
    <div className="running-total">
      <div>
        <span className="muted">Order total</span> <strong>{gbp(total)}</strong>
        {subDiscount > 0 && <span className="rt-saved"> · you save {gbp(subDiscount)}</span>}
      </div>
      <div className="muted small">25% deposit to confirm: {gbp(deposit)}</div>
    </div>
  );
}
