import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type BreadAvailabilityResponse, type BreadOrderDTO, type BreadProduct, type LocationT } from "../lib/api";
import { gbp, formatDate, formatDateLong } from "../lib/format";
import { BreadCalendar, unavailableReason } from "../components/BreadCalendar";
import { monthStart, daysInMonth } from "../components/CapacityCalendar";
import { usePageTitle } from "../lib/title";
import { Crest, Ornament } from "../components/BrandMark";

const NOTES_LIMIT = 200;

export default function Bread() {
  usePageTitle("Order bread");

  const [locations, setLocations] = useState<LocationT[]>([]);
  const [locationId, setLocationId] = useState("");
  const [products, setProducts] = useState<BreadProduct[]>([]);
  const [limits, setLimits] = useState({ minOrderQty: 1, maxItemQty: 20 });
  const [availability, setAvailability] = useState<BreadAvailabilityResponse | null>(null);
  const [calMonth, setCalMonth] = useState(() => monthStart(new Date().toISOString().slice(0, 10)));
  const [date, setDate] = useState<string | null>(null);

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<BreadOrderDTO | null>(null);

  useEffect(() => {
    Promise.all([api.locations(), api.bread.orderLimits()])
      .then(([ls, lim]) => {
        setLocations(ls);
        setLimits(lim);
        if (ls[0]) setLocationId((prev) => prev || ls[0].id);
      })
      .catch(() => setLoadError("Couldn't load the bread menu. Please try again."));
  }, []);

  useEffect(() => {
    if (!locationId) return;
    setProducts([]);
    api.bread.products(locationId).then(setProducts).catch(() => setProducts([]));
  }, [locationId]);

  // Availability follows the chosen shop AND the month on show, same paging as the board calendar.
  useEffect(() => {
    if (!locationId) return;
    setAvailability(null);
    const today = new Date().toISOString().slice(0, 10);
    const from = calMonth.slice(0, 7) === today.slice(0, 7) ? today : calMonth;
    const span = daysInMonth(calMonth) - (Number(from.slice(8, 10)) - 1) + 1;
    api.bread.availability(locationId, from, span).then(setAvailability).catch(() => setAvailability(null));
  }, [locationId, calMonth]);

  // Changing shop invalidates the picked date and quantities (different menu, different calendar).
  function changeLocation(next: string) {
    setLocationId(next);
    setDate(null);
    setQuantities({});
  }

  const lines = useMemo(
    () => products.map((p) => ({ product: p, quantity: quantities[p.id] ?? 0 })).filter((l) => l.quantity > 0),
    [products, quantities],
  );
  const totalQty = lines.reduce((s, l) => s + l.quantity, 0);
  const total = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);

  function setQty(productId: string, qty: number) {
    const clamped = Math.max(0, Math.min(limits.maxItemQty, qty));
    setQuantities((prev) => ({ ...prev, [productId]: clamped }));
  }

  const selectedDay = availability?.days.find((d) => d.date === date);
  const dateReason = unavailableReason(selectedDay);
  const formValid =
    totalQty >= limits.minOrderQty &&
    !!date &&
    !!selectedDay?.bookable &&
    name.trim().length > 0 &&
    phone.trim().length >= 8 &&
    notes.length <= NOTES_LIMIT;

  async function submit() {
    setError(null);
    if (!date) {
      setError("Please choose a collection date.");
      return;
    }
    if (totalQty < limits.minOrderQty) {
      setError(`Minimum order is ${limits.minOrderQty} item${limits.minOrderQty === 1 ? "" : "s"}.`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.bread.createOrder({
        locationId,
        collectionDate: date,
        items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
        customerName: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setConfirmed(res.order);
    } catch (e: any) {
      // A slot that filled up (or a shop that just closed the day) between page load and
      // submit comes back as a clear server error — never silently retried as a new order.
      setError(e?.message || "Couldn't place your order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed) {
    return (
      <div className="co-bread co-confirm is-paid">
        <div className="wrap-narrow cf-wrap">
          <header className="confirm-hero cf-hero">
            <Crest className="cf-crest" />
            <p className="eyebrow cf-status">Booked in · Pay on collection</p>
            <h1 className="cf-h">Your bread&apos;s booked in!</h1>
            <Ornament />
            <p className="confirm-copy cf-copy">
              Pay on collection — we&apos;ll text you if anything changes.
              {confirmed.email && " We've also emailed you a confirmation."}
            </p>
          </header>

          <article className="cf-receipt" aria-label="Your bread order">
            <div className="cf-receipt-top">
              <p className="cf-shop">Kelly&apos;s</p>
              <p className="cf-shop-sub">Bakery counter{confirmed.locationName ? ` · ${confirmed.locationName}` : ""}</p>
              <div className="ref-badge">Order reference<strong>{confirmed.ref}</strong></div>
            </div>
            {confirmed.items.length > 0 && (
              <div className="review cf-sec">
                {confirmed.items.map((it) => (
                  <div key={it.id} className="review-row"><span>{it.quantity}× {it.name}</span><span>{gbp(it.lineTotal)}</span></div>
                ))}
              </div>
            )}
            <div className="review cf-sec cf-details">
              <div className="review-row"><span className="muted">Collection</span><span>{formatDateLong(confirmed.collectionDate)}</span></div>
              <div className="review-row"><span className="muted">From</span><span>{confirmed.locationName}</span></div>
              {confirmed.notes && <div className="review-row"><span className="muted">Notes</span><span>{confirmed.notes}</span></div>}
            </div>
            <div className="review cf-sec cf-totals">
              <div className="review-row cf-total"><span>Total — pay on collection</span><span>{gbp(confirmed.total)}</span></div>
            </div>
            <p className="cf-receipt-foot">Thank you · Quote {confirmed.ref} at the counter</p>
          </article>

          <div className="cf-actions">
            <Link className="btn" to="/">Back to menu</Link>
          </div>
          <p className="muted center footnote cf-foot">Need to change something? Quote your reference {confirmed.ref}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="co-bread">
      <div className="wrap br-wrap">
        <header className="br-head">
          <p className="eyebrow">Fresh bread · Click &amp; collect</p>
          <h1 className="co-title">Order bread for collection</h1>
          <p className="br-lede">Pre-order your bread and collect it from your local shop — pay when you pick it up.</p>
          <ol className="br-how" aria-label="How it works">
            <li><span>i.</span> Pick your loaves</li>
            <li><span>ii.</span> Choose a day</li>
            <li><span>iii.</span> Pay when you collect</li>
          </ol>
        </header>

        {loadError && <div className="notice danger">{loadError}</div>}

        <div className="br-layout">
          <div className="br-main">
            <section className="br-block" aria-labelledby="br-loaves-h">
              <h2 className="co-block-h" id="br-loaves-h"><span>i.</span> Your loaves</h2>
              {products.length === 0 && <p className="muted">No bread items available at this shop right now.</p>}
              <ul className="br-list">
                {products.map((p) => {
                  const q = quantities[p.id] ?? 0;
                  return (
                    <li key={p.id} className={`br-item${q > 0 ? " is-chosen" : ""}`}>
                      <div className="br-item-info">
                        <span className="br-item-name">{p.name}</span>
                        {p.description && <span className="br-item-desc">{p.description}</span>}
                      </div>
                      <span className="br-item-price">{gbp(p.price)}</span>
                      <div className="stepper" role="group" aria-label={`${p.name} quantity`}>
                        <button type="button" onClick={() => setQty(p.id, q - 1)} aria-label="Decrease" disabled={q === 0}>−</button>
                        <span className="stepper-val">{q}</span>
                        <button type="button" onClick={() => setQty(p.id, q + 1)} aria-label="Increase">+</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="br-block" aria-labelledby="br-day-h">
              <h2 className="co-block-h" id="br-day-h"><span>ii.</span> Collection day</h2>
              <label className="field">
                <span>Collection shop</span>
                <select value={locationId} onChange={(e) => changeLocation(e.target.value)}>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </label>
              <div className="field">
                <span className="field-label">Collection date</span>
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
            </section>

            <section className="br-block" aria-labelledby="br-you-h">
              <h2 className="co-block-h" id="br-you-h"><span>iii.</span> Your details</h2>
              <label className="field"><span>Your name</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
              <div className="co-grid-2">
                <label className="field"><span>Mobile number</span><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="07…" /></label>
                <label className="field"><span>Email (optional)</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
              </div>
              <label className="field">
                <span>Notes (optional)</span>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, NOTES_LIMIT))} rows={2} maxLength={NOTES_LIMIT} />
                <span className="br-count">{notes.length}/{NOTES_LIMIT}</span>
              </label>
              <p className="br-small">
                We use your name, mobile and (if given) email only to take and fulfil this order, and to contact you if
                anything changes. We keep order records for our normal accounting period, then delete them. To ask us to
                delete your details sooner, contact the shop with your order reference.
              </p>
            </section>
          </div>

          <aside className="br-summary" aria-labelledby="br-sum-h">
            <h2 className="br-sum-h" id="br-sum-h">Your bread</h2>
            {lines.length === 0 ? (
              <p className="br-sum-empty">Nothing chosen yet — add a loaf or two.</p>
            ) : (
              <ul className="br-sum-lines">
                {lines.map((l) => (
                  <li key={l.product.id}><span>{l.quantity} × {l.product.name}</span><span>{gbp(l.product.price * l.quantity)}</span></li>
                ))}
              </ul>
            )}
            <div className="br-sum-when">
              <span className="co-sum-label">Collection</span>
              <strong>{date && selectedDay?.bookable ? formatDateLong(date) : "Choose a day"}</strong>
              {locations.find((l) => l.id === locationId)?.name && <span>From Kelly&apos;s, {locations.find((l) => l.id === locationId)?.name}</span>}
            </div>
            <div className="running-total br-total">
              <div className="rt-row rt-total"><span>Total{totalQty > 0 ? ` (${totalQty} item${totalQty === 1 ? "" : "s"})` : ""}</span><strong>{gbp(total)}</strong></div>
              <p className="rt-note">Pay on collection — no card needed now.</p>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="btn br-place" disabled={!formValid || submitting} onClick={submit}>
              {submitting ? "Placing…" : "Place order"}
            </button>
            {date && !selectedDay?.bookable ? null : date && (
              <p className="br-sum-foot">Collection {formatDate(date)} — pay in shop, no card needed now.</p>
            )}
            {!formValid && (
              <p className="br-sum-foot">
                {totalQty < limits.minOrderQty ? "Add a loaf" : !date || !selectedDay?.bookable ? "Choose a collection day" : "Add your name and mobile"} to place your order.
              </p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
