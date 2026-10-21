import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
import { gbp, formatDate, formatDateLong } from "../lib/format";
import { CapacityCalendar, daysInMonth, monthStart } from "../components/CapacityCalendar";
import { AddOnsStep } from "../components/AddOnsStep";
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
  // Phone only: the order summary folds away above the form.
  const [summaryOpen, setSummaryOpen] = useState(false);

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
      <div className="co order-page">
        <section className="co-empty wrap">
          <h1 className="co-title">Your order</h1>
          <p className="co-empty-lede">Your order is empty.</p>
          <div className="co-empty-actions">
            <button className="btn" onClick={() => navigate("/platters")}>Browse boards</button>
            <button className="btn btn-secondary" onClick={() => navigate("/christmas")}>See the Christmas menu</button>
          </div>
          <p className="co-empty-more">
            Feeding a crowd? <Link to="/plan">Plan your event</Link>. Just some bread? <Link to="/bread">Order it for collection</Link>.
          </p>
        </section>
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
  // A pre-order basket starts on the details step, so its indicator shows the two steps it
  // actually goes through (the extras stay reachable with Back).
  const visibleSteps: Step[] = isPreorder && step !== "extras" ? ["details", "review"] : STEPS;
  const locationName = locations.find((l) => l.id === locationId)?.name ?? "";
  const itemCount = boardLines.reduce((s, l) => s + l.quantity, 0);
  const shopMore = () => navigate(isPreorder ? "/christmas" : "/platters");

  return (
    <div className={`co order-page${isPreorder ? " is-preorder" : ""}`}>
      <div className="wrap co-wrap">
        <header className="co-head">
          <button className="link-back co-back" onClick={shopMore}>Keep shopping</button>
          <h1 className="co-title">Your order</h1>
          {isPreorder && <p className="co-kind">Christmas pre-order</p>}

          <ol className="co-steps" aria-label="Order steps">
            {visibleSteps.map((s, i) => {
              const idx = STEPS.indexOf(s);
              const state = idx === stepIdx ? " is-active" : idx < stepIdx ? " is-done" : "";
              const inner = (
                <>
                  <span className="co-step-n" aria-hidden="true">{i + 1}</span>
                  <span className="co-step-l">{STEP_LABELS[s]}</span>
                </>
              );
              return (
                <li key={s} className={`co-step${state}`} aria-current={idx === stepIdx ? "step" : undefined}>
                  {idx < stepIdx ? (
                    <button type="button" className="co-step-btn" onClick={() => setStep(s)}>{inner}</button>
                  ) : (
                    <span className="co-step-btn">{inner}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </header>

        <div className="co-layout">
          {/* ---------- Order summary: sticky on the right, collapsible on a phone ---------- */}
          <aside className={`co-summary${summaryOpen ? " is-open" : ""}`} aria-label="Order summary">
            <button
              type="button"
              className="co-sum-toggle"
              aria-expanded={summaryOpen}
              aria-controls="co-sum-panel"
              onClick={() => setSummaryOpen((o) => !o)}
            >
              <span className="co-sum-toggle-l">
                <span className="co-sum-toggle-t">{summaryOpen ? "Hide" : "Show"} order summary <i className="co-caret" aria-hidden="true" /></span>
                <small>{itemCount} item{itemCount === 1 ? "" : "s"}{date ? `, ${formatDate(date)}` : ""}</small>
              </span>
              <span className="co-sum-toggle-r">
                <strong>{gbp(finalTotal)}</strong>
                <small>{payInFull ? "in full" : `${gbp(finalDeposit)} deposit`}</small>
              </span>
            </button>

            <div className="co-sum-panel" id="co-sum-panel">
              <div className="co-sum-head">
                <h2 className="co-sum-h">{isPreorder ? "Your order" : "Your boards"}</h2>
                <span className="co-sum-count">{itemCount} item{itemCount === 1 ? "" : "s"}</span>
              </div>

              <ul className="co-lines">
                {boardLines.map((l) => {
                  const meta = l.board.variantLabel
                    ?? (l.board.kind === "product" ? l.board.unitLabel : l.board.serves ? `feeds ${l.board.serves}` : null);
                  return (
                    <li key={l.board.id} className="order-line co-line">
                      <span className="co-thumb" aria-hidden="true">
                        {l.board.imageUrl && <img src={l.board.imageUrl} alt="" loading="lazy" />}
                      </span>
                      <div className="co-line-info">
                        <span className="ol-name">{l.board.name}</span>
                        {meta && <span className="co-line-meta">{meta}</span>}
                        <div className="stepper co-stepper" role="group" aria-label={`${l.board.name} quantity`}>
                          <button type="button" onClick={() => setBoardQty(l.board.id, l.quantity - 1)} aria-label="Decrease">−</button>
                          <span className="stepper-val">{l.quantity}</span>
                          <button type="button" onClick={() => setBoardQty(l.board.id, l.quantity + 1)} aria-label="Increase">+</button>
                        </div>
                      </div>
                      <span className="ol-price">{gbp(l.unitPrice * l.quantity)}</span>
                    </li>
                  );
                })}
              </ul>

              {addOnLines.length > 0 && (
                <ul className="co-extras" aria-label="Extras">
                  {addOnLines.map((l) => (
                    <li key={l.addOn.id}>
                      <span>{l.quantity} × {l.addOn.name}</span>
                      <span>{gbp(l.unitPrice * l.quantity)}</span>
                    </li>
                  ))}
                </ul>
              )}

              <button type="button" className="co-add-more" onClick={shopMore}>
                {isPreorder ? "+ Add something else" : "+ Add another board"}
              </button>

              {date && (
                <div className="co-sum-when">
                  <span className="co-sum-label">{activeSub ? "First collection" : "Collection"}</span>
                  <strong>{formatDateLong(date)}</strong>
                  {locationName && <span>From Kelly&apos;s, {locationName}</span>}
                </div>
              )}
            </div>

            <div className="running-total">
              {(bundleSaving.amount > 0 || subDiscount > 0) && (
                <div className="rt-row"><span>Subtotal</span><span>{gbp(totals.total)}</span></div>
              )}
              {bundleSaving.amount > 0 && (
                <div className="rt-row is-saving"><span>{bundleSaving.name} saving</span><span>−{gbp(bundleSaving.amount)}</span></div>
              )}
              {subDiscount > 0 && (
                <div className="rt-row is-saving"><span>Regular-order saving ({subPct}%)</span><span>−{gbp(subDiscount)}</span></div>
              )}
              <div className="rt-row rt-total">
                <span>{activeSub ? "Total per delivery" : "Order total"}</span>
                <strong>{gbp(finalTotal)}</strong>
              </div>
              {payInFull ? (
                <>
                  <div className="rt-row rt-today"><span>{paymentsLive ? "To pay today" : "To pay"}</span><span>{gbp(finalDeposit)}</span></div>
                  <p className="rt-note">Paid in full when you order. Nothing to pay at the counter.</p>
                </>
              ) : (
                <>
                  <div className="rt-row rt-today"><span>25% deposit to confirm</span><span>{gbp(finalDeposit)}</span></div>
                  <div className="rt-row rt-later"><span>Balance on collection</span><span>{gbp(finalBalance)}</span></div>
                </>
              )}
            </div>
          </aside>

          {/* ---------- Steps ---------- */}
          <div className="co-main">
            {step === "extras" && (
              <section className="co-panel">
                <AddOnsStep addOns={addOns} headcount={headcount} value={cart?.addOns ?? []} onChange={(next) => update({ addOns: next })} />
                {addOns.length === 0 && catalogueReady && (
                  <p className="muted co-none">No extras needed. Carry on to your details.</p>
                )}
                <div className="step-actions co-actions">
                  <button className="btn" onClick={() => setStep("details")}>Continue to details</button>
                </div>
              </section>
            )}

            {step === "details" && (
              <section className="order-details co-panel">
                <h2 className="co-panel-h">Collection &amp; contact</h2>
                <p className="co-panel-sub">
                  {isPreorder
                    ? "Choose the day you’ll call in. We’ll have it ready with your name on it."
                    : "Tell us when you’d like to collect and who it’s for. Nothing is paid yet."}
                </p>

                {!isPreorder && (
                  <div className="co-block">
                    <h3 className="co-block-h">Your party</h3>
                    <div className="co-grid-2">
                      <label className="field">
                        <span>How many people are you feeding?</span>
                        <div className="stepper co-stepper is-lg" role="group" aria-label="Headcount">
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
                        <span>Occasion (optional)</span>
                        <select value={occasion} onChange={(e) => setOccasion(e.target.value as Occasion | "")}>
                          <option value="">Choose one</option>
                          {OCCASIONS.map((o) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                )}

                <div className="co-block">
                  <h3 className="co-block-h">Collection day</h3>
                  <label className="field">
                    <span>Collect from</span>
                    <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </label>

                  <div className="field co-cal-field">
                    <span>Collection date</span>
                    {window_.note && !window_.conflict && <p className="co-window">{window_.note}</p>}
                    <CapacityCalendar
                      days={availability?.days ?? []}
                      selected={date}
                      onSelect={setDate}
                      month={calMonth}
                      onMonthChange={setCalMonth}
                      minMonth={window_.from && !window_.conflict ? monthStart(window_.from) : undefined}
                      maxMonth={window_.to && !window_.conflict ? monthStart(window_.to) : undefined}
                    />
                    {!availability && <p className="muted co-loading">Loading dates…</p>}
                    {window_.conflict && (
                      <p className="form-error" role="alert">
                        These items can&apos;t be collected on the same day. Please order them separately.
                      </p>
                    )}
                    {date && selectedDay?.bookable && (
                      <p className="co-chosen" role="status">
                        Collecting <strong>{formatDateLong(date)}</strong>{locationName ? ` from ${locationName}` : ""}.
                      </p>
                    )}
                  </div>
                </div>

                {subOn && !isPreorder && (
                  <div className="co-block">
                    <h3 className="co-block-h">Make it a regular order?</h3>
                    <SubscribeSave
                      value={subFreq}
                      onChange={setSubscription}
                      discountPct={counts?.subscribeSaveDiscountPct ?? 10}
                      invoiced={occasion === "Corporate"}
                    />
                  </div>
                )}

                <div className="co-block">
                  <h3 className="co-block-h">Your details</h3>
                  <label className="field"><span>Your name</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
                  <div className="co-grid-2">
                    <label className="field"><span>Phone</span><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" /></label>
                    <label className="field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
                  </div>
                  <label className="field"><span>{isPreorder ? "Notes, for example \"slice the ham, please\" (optional)" : "Allergies or notes (optional)"}</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></label>

                  <div className="field gift-toggle co-gift">
                    <label className="gift-check">
                      <input type="checkbox" checked={isGift} onChange={(e) => setIsGift(e.target.checked)} />
                      <span>This is a gift: add a printed note</span>
                    </label>
                    {isGift && (
                      <div className="gift-fields">
                        <label className="field"><span>Who&apos;s it for?</span><input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Recipient's name" /></label>
                        <label className="field"><span>Gift message (we&apos;ll print it and tuck it in)</span><textarea rows={2} maxLength={500} value={giftMessage} onChange={(e) => setGiftMessage(e.target.value)} placeholder="Happy birthday! Enjoy every bite x" /></label>
                      </div>
                    )}
                  </div>
                </div>

                <div className="step-actions co-actions">
                  <button className="btn-ghost co-textlink" onClick={() => setStep("extras")}>Back</button>
                  <button className="btn" disabled={!detailsValid} onClick={() => setStep("review")}>Review order</button>
                </div>
                {!detailsValid && (
                  <p className="co-hint">
                    {!date ? "Choose a collection day" : "Add your name, phone and email"} to review your order.
                  </p>
                )}
              </section>
            )}

            {step === "review" && (
              <section className="order-review co-panel">
                <h2 className="co-panel-h">Review &amp; confirm</h2>
                <p className="co-panel-sub">One last look before it goes to the deli.</p>

                <div className="card review-summary co-receipt">
                  <p className="co-receipt-h">Kelly&apos;s Deli{locationName ? `, ${locationName}` : ""}</p>
                  {boardLines.map((l) => (
                    <div key={l.board.id} className="review-row"><span>{l.quantity}× {l.board.name}{l.board.variantLabel ? `, ${l.board.variantLabel}` : ""}</span><span>{gbp(l.unitPrice * l.quantity)}</span></div>
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
                    <div className="review-row is-pay"><span>{paymentsLive ? "To pay now" : "To pay"}</span><span>{gbp(finalDeposit)}</span></div>
                  ) : (
                    <>
                      <div className="review-row is-pay"><span>Deposit due (25%)</span><span>{gbp(finalDeposit)}</span></div>
                      <div className="review-row"><span>Balance on collection</span><span>{gbp(finalBalance)}</span></div>
                    </>
                  )}
                  {date && <div className="review-row muted is-meta"><span>{activeSub ? "First collection" : "Collection"}</span><span>{formatDate(date)}</span></div>}
                  {isGift && recipientName.trim() && <div className="review-row muted is-meta"><span>Gift for</span><span>{recipientName.trim()}</span></div>}
                </div>

                <dl className="co-who">
                  <div><dt>Name</dt><dd>{name.trim()}</dd></div>
                  <div><dt>Phone</dt><dd>{phone.trim()}</dd></div>
                  <div><dt>Email</dt><dd>{email.trim()}</dd></div>
                  {!isPreorder && <div><dt>Feeding</dt><dd>{headcount} {headcount === 1 ? "person" : "people"}</dd></div>}
                  {!isPreorder && occasion && <div><dt>Occasion</dt><dd>{occasion}</dd></div>}
                  {notes.trim() && <div><dt>Notes</dt><dd>{notes.trim()}</dd></div>}
                </dl>
                <button type="button" className="co-textlink co-edit" onClick={() => setStep("details")}>Change these details</button>

                {activeSub ? (
                  <p className="deposit-policy recurring-note">
                    <strong>You&apos;re setting up a {activeSub} board.</strong> {paymentsLive ? "Only your first board's deposit is taken today" : "No card is taken now"} and nothing bills
                    automatically. We&apos;ll get in touch to set your schedule up with you and confirm each delivery before we
                    make it. The 25% deposit confirms your first board. Pause, skip or cancel any time.
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
                <div className="step-actions co-actions">
                  <button className="btn-ghost co-textlink" onClick={() => setStep("details")}>Back</button>
                  <button className="btn" disabled={submitting} onClick={submit}>
                    {submitting ? (paymentsLive ? "Taking you to payment…" : "Placing…") : paymentsLive ? `Pay ${gbp(finalDeposit)} securely` : "Place order request"}
                  </button>
                </div>
                <p className="co-terms">
                  By placing your order you agree to our <Link to="/terms">terms</Link>. Our <Link to="/privacy">privacy policy</Link> explains how we look after your details.
                </p>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
