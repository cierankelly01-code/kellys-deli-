import { useEffect, useMemo, useState } from "react";
import { api, type CategoryCounts, type GroceryProductT, type LocationT, type SubscriptionFrequency } from "../lib/api";
import { gbp, formatDate, formatDateLong } from "../lib/format";
import { BreadCalendar, unavailableReason } from "../components/BreadCalendar";
import { monthStart, daysInMonth } from "../components/CapacityCalendar";
import { Header } from "../components/Header";
import { SubscribeSave } from "../components/SubscribeSave";
import { usePageTitle } from "../lib/title";

const NOTES_LIMIT = 200;

export default function Lunch() {
  usePageTitle(
    "Order lunch",
    "A sandwich, crisps and a drink, or a fresh salad box — ready to collect from Kelly's Deli tomorrow. Subscribe & save for a standing weekly order.",
  );

  const [locations, setLocations] = useState<LocationT[]>([]);
  const [locationId, setLocationId] = useState("");
  const [products, setProducts] = useState<GroceryProductT[] | null>(null);
  const [counts, setCounts] = useState<CategoryCounts | null>(null);
  const [calMonth, setCalMonth] = useState(() => monthStart(new Date().toISOString().slice(0, 10)));
  const [date, setDate] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Awaited<ReturnType<typeof api.groceries.availability>> | null>(null);

  const [base, setBase] = useState<string | null>(null); // selected sandwich id, or the salad box id
  const [withCrisps, setWithCrisps] = useState(false);
  const [subFreq, setSubFreq] = useState<SubscriptionFrequency | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<Awaited<ReturnType<typeof api.groceries.createOrder>>["order"] | null>(null);

  useEffect(() => {
    api.locations().then((ls) => {
      setLocations(ls);
      if (ls[0]) setLocationId((prev) => prev || ls[0].id);
    }).catch(() => setLoadError("Couldn't load our shops. Please try again."));
    api.categories().then(setCounts).catch(() => setCounts(null));
  }, []);

  useEffect(() => {
    if (!locationId) return;
    setProducts(null);
    api.groceries.products(locationId).then(setProducts).catch(() => setProducts([]));
  }, [locationId]);

  useEffect(() => {
    if (!locationId) return;
    setAvailability(null);
    const today = new Date().toISOString().slice(0, 10);
    const from = calMonth.slice(0, 7) === today.slice(0, 7) ? today : calMonth;
    const span = daysInMonth(calMonth) - (Number(from.slice(8, 10)) - 1) + 1;
    api.groceries.availability(locationId, from, span).then(setAvailability).catch(() => setAvailability(null));
  }, [locationId, calMonth]);

  // Default the collection date to the earliest bookable day — almost always tomorrow,
  // which is the whole point of this page. Only runs once per availability load.
  useEffect(() => {
    if (date || !availability) return;
    const first = availability.days.find((d) => d.bookable);
    if (first) setDate(first.date);
  }, [availability, date]);

  function changeLocation(next: string) {
    setLocationId(next);
    setDate(null);
    setBase(null);
    setWithCrisps(false);
  }

  const sandwiches = useMemo(
    () => (products ?? []).filter((p) => p.department === "sandwiches" && p.active),
    [products],
  );
  const saladBox = useMemo(
    () => (products ?? []).find((p) => p.department === "salads" && /salad box/i.test(p.name)) ?? null,
    [products],
  );
  const crisps = useMemo(
    () => (products ?? []).find((p) => /crisps/i.test(p.name)) ?? null,
    [products],
  );
  const baseOptions = useMemo(
    () => [...sandwiches, ...(saladBox ? [saladBox] : [])],
    [sandwiches, saladBox],
  );
  const baseProduct = baseOptions.find((p) => p.id === base) ?? null;

  const items = useMemo(() => {
    const lines: { productId: string; quantity: number }[] = [];
    if (baseProduct) lines.push({ productId: baseProduct.id, quantity: 1 });
    if (withCrisps && crisps) lines.push({ productId: crisps.id, quantity: 1 });
    return lines;
  }, [baseProduct, crisps, withCrisps]);

  const subOn = counts?.subscribeSave !== false;
  const subPct = subFreq && subOn ? counts?.subscribeSaveDiscountPct ?? 10 : 0;
  const rawTotal = (baseProduct?.price ?? 0) + (withCrisps && crisps ? crisps.price : 0);
  const total = subPct > 0 ? Math.round(rawTotal * (1 - subPct / 100) * 100) / 100 : rawTotal;

  const selectedDay = availability?.days.find((d) => d.date === date);
  const dateReason = unavailableReason(selectedDay);
  const isTomorrow = date === new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const formValid =
    items.length > 0 &&
    !!date &&
    !!selectedDay?.bookable &&
    name.trim().length > 0 &&
    phone.trim().length >= 8 &&
    notes.length <= NOTES_LIMIT;

  async function submit() {
    setError(null);
    if (!date) { setError("Please choose a collection date."); return; }
    if (items.length === 0) { setError("Pick a sandwich or a salad box first."); return; }
    setSubmitting(true);
    try {
      const res = await api.groceries.createOrder({
        locationId,
        collectionDate: date,
        items,
        customerName: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
        isSubscription: subFreq ? true : undefined,
        subscriptionFrequency: subFreq || undefined,
      });
      // Paid in full online: off to Stripe. The order page confirms once it's paid. No
      // payment page (Stripe off or down) means pay on collection, confirmed right here.
      const checkoutUrl = res.payment?.checkoutUrl;
      if (checkoutUrl?.startsWith("https://checkout.stripe.com/")) {
        window.location.assign(checkoutUrl);
        return;
      }
      setConfirmed(res.order);
    } catch (e: any) {
      setError(e?.message || "Couldn't place your order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed) {
    return (
      <div className="app">
        <Header />
        <div className="confirm-hero center">
          <div className="tick">✓</div>
          <h1>Lunch is booked in!</h1>
          <p className="confirm-collection">Collection <strong>{formatDateLong(confirmed.collectionDate)}</strong> — {confirmed.locationName}</p>
          <p className="confirm-copy">
            Pay on collection — we&apos;ll text you if anything changes.
            {confirmed.isSubscription && " We'll be in touch to set up your standing order — no card needed now."}
          </p>
          <div className="ref-badge">Order reference<strong>{confirmed.ref}</strong></div>
        </div>
        <div className="card review">
          {confirmed.items.map((it) => (
            <div key={it.id} className="review-row"><span>{it.quantity}× {it.name}</span><span>{gbp(it.lineTotal)}</span></div>
          ))}
          {confirmed.isSubscription && confirmed.subscriptionDiscount ? (
            <div className="review-row"><span className="muted">Subscribe &amp; save</span><span>−{gbp(confirmed.subscriptionDiscount)}</span></div>
          ) : null}
          <div className="review-row"><span className="muted">Collection</span><span>{formatDateLong(confirmed.collectionDate)}</span></div>
          <hr />
          <div className="review-row"><span className="muted">Total — pay on collection</span><span style={{ fontWeight: 700 }}>{gbp(confirmed.total)}</span></div>
        </div>
        <p className="muted center footnote">Need to change something? Quote your reference {confirmed.ref}.</p>
        <a className="btn btn-secondary" href="/">Back to menu</a>
      </div>
    );
  }

  return (
    <div className="app app-wide">
      <Header />

      <header className="cat-hero" style={{ backgroundImage: "url(/images/grocery-ham-cheese.webp)" }}>
        <div className="cat-hero-scrim">
          <h1 className="cat-hero-h">{isTomorrow ? "Order lunch for tomorrow" : "Order lunch"}</h1>
          <p className="cat-hero-tag">Sandwich, crisps and a drink, or a fresh salad box — click &amp; collect</p>
        </div>
      </header>
      <p className="cat-desc">
        Build your own meal deal, or make it a standing weekly order with Subscribe &amp; Save below.
      </p>

      {loadError && <div className="notice danger">{loadError}</div>}

      {locations.length > 1 && (
        <label className="field">
          <span>Collection shop</span>
          <select value={locationId} onChange={(e) => changeLocation(e.target.value)}>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
      )}

      {products === null && <p className="muted center">Loading today's lunch menu…</p>}

      {products !== null && baseOptions.length === 0 && (
        <p className="muted center" role="status">Our lunch menu is being set up — check back soon.</p>
      )}

      {baseOptions.length > 0 && (
        <>
          <section className="board-section dept-section" style={{ marginTop: 24 }}>
            <h2 className="section-h">Choose your lunch</h2>
            <div className="lunch-pick-grid">
              {baseOptions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`lunch-pick-card${base === p.id ? " is-selected" : ""}`}
                  onClick={() => setBase(p.id)}
                  aria-pressed={base === p.id}
                >
                  {p.imageUrl && <img src={p.imageUrl} alt="" loading="lazy" />}
                  <span className="lunch-pick-name">{p.name}</span>
                  <span className="lunch-pick-price">{gbp(p.price)}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="board-section dept-section" style={{ marginTop: 24 }}>
            <h2 className="section-h">Add a little extra</h2>
            <div className="lunch-pick-grid">
              {crisps ? (
                <button
                  type="button"
                  className={`lunch-pick-card${withCrisps ? " is-selected" : ""}`}
                  onClick={() => setWithCrisps((v) => !v)}
                  aria-pressed={withCrisps}
                >
                  <span className="lunch-pick-name">Crisps</span>
                  <span className="lunch-pick-price">+{gbp(crisps.price)}</span>
                </button>
              ) : (
                <div className="lunch-pick-card is-disabled" aria-disabled="true">
                  <span className="lunch-pick-name">Crisps</span>
                  <span className="lunch-pick-price muted">Coming soon</span>
                </div>
              )}
              <div className="lunch-pick-card is-disabled" aria-disabled="true">
                <span className="lunch-pick-name">A drink</span>
                <span className="lunch-pick-price muted">Coming soon</span>
              </div>
            </div>
          </section>

          {items.length > 0 && (
            <div className="running-total" style={{ marginTop: 24 }}>
              <div><span className="muted">Your lunch</span> <strong>{gbp(total)}</strong></div>
              <div className="muted small">Paid securely online when you order{subPct > 0 ? ` · ${subPct}% subscribe & save applied` : ""}</div>
            </div>
          )}

          <section className="card" style={{ marginTop: 24 }}>
            <h2 className="step-h">Collect your order</h2>

            <div className="field">
              <span>Collection date</span>
              <BreadCalendar
                days={availability?.days ?? []}
                selected={date}
                onSelect={setDate}
                month={calMonth}
                onMonthChange={setCalMonth}
              />
              {!availability && <p className="muted">Loading dates…</p>}
              {date && dateReason && <p className="notice danger" role="alert">{dateReason}</p>}
            </div>

            {subOn && (
              <div className="field">
                <span>Make it a standing weekly order?</span>
                <SubscribeSave value={subFreq} onChange={setSubFreq} discountPct={counts?.subscribeSaveDiscountPct ?? 10} />
              </div>
            )}

            <label className="field"><span>Your name</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
            <label className="field"><span>Mobile number</span><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="07…" /></label>
            <label className="field"><span>Email (optional)</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
            <label className="field">
              <span>Notes (optional)</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, NOTES_LIMIT))} rows={2} maxLength={NOTES_LIMIT} />
              <span className="muted small">{notes.length}/{NOTES_LIMIT}</span>
            </label>

            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="step-actions">
              <button className="btn" disabled={!formValid || submitting} onClick={submit}>
                {submitting ? "Placing…" : items.length === 0 ? "Choose your lunch" : "Order and pay"}
              </button>
            </div>
            {date && selectedDay?.bookable && (
              <p className="muted small">Collection {formatDate(date)} — you pay securely online when you order. Fully refundable if you cancel 48 hours or more before collection.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
