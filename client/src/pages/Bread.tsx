import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type BreadAvailabilityResponse, type BreadOrderDTO, type BreadProduct, type LocationT } from "../lib/api";
import { gbp, formatDate, formatDateLong } from "../lib/format";
import { BreadCalendar, unavailableReason } from "../components/BreadCalendar";
import { monthStart, daysInMonth } from "../components/CapacityCalendar";
import { Header } from "../components/Header";
import { usePageTitle } from "../lib/title";

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
      <div className="app">
        <Header />
        <div className="confirm-hero center">
          <div className="tick">✓</div>
          <h1>Your bread&apos;s booked in!</h1>
          <p className="confirm-copy">
            Pay on collection — we&apos;ll text you if anything changes.
            {confirmed.email && " We've also emailed you a confirmation."}
          </p>
          <div className="ref-badge">Order reference<strong>{confirmed.ref}</strong></div>
        </div>

        <div className="card review">
          {confirmed.items.map((it) => (
            <div key={it.id} className="review-row"><span>{it.quantity}× {it.name}</span><span>{gbp(it.lineTotal)}</span></div>
          ))}
          <div className="review-row"><span className="muted">Collection</span><span>{formatDateLong(confirmed.collectionDate)}</span></div>
          <div className="review-row"><span className="muted">From</span><span>{confirmed.locationName}</span></div>
          {confirmed.notes && <div className="review-row"><span className="muted">Notes</span><span>{confirmed.notes}</span></div>}
          <hr />
          <div className="review-row"><span className="muted">Total — pay on collection</span><span style={{ fontWeight: 700 }}>{gbp(confirmed.total)}</span></div>
        </div>

        <p className="muted center footnote">Need to change something? Quote your reference {confirmed.ref}.</p>
        <Link className="btn btn-secondary" to="/">Back to menu</Link>
      </div>
    );
  }

  return (
    <div className="app order-page">
      <Header />
      <h1 className="page-h">Order bread for collection</h1>
      <p className="muted">Pre-order your bread and collect it from your local shop — pay when you pick it up.</p>

      {loadError && <div className="notice danger">{loadError}</div>}

      <label className="field">
        <span>Collection shop</span>
        <select value={locationId} onChange={(e) => changeLocation(e.target.value)}>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </label>

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

      <section className="order-boards card">
        <h2 className="step-h">Bread</h2>
        {products.length === 0 && <p className="muted">No bread items available at this shop right now.</p>}
        {products.map((p) => (
          <div key={p.id} className="order-line">
            <div>
              <span className="ol-name">{p.name}</span>
              {p.description && <span className="muted ol-feeds"> · {p.description}</span>}
            </div>
            <div className="stepper" role="group" aria-label={`${p.name} quantity`}>
              <button type="button" onClick={() => setQty(p.id, (quantities[p.id] ?? 0) - 1)} aria-label="Decrease">−</button>
              <span className="stepper-val">{quantities[p.id] ?? 0}</span>
              <button type="button" onClick={() => setQty(p.id, (quantities[p.id] ?? 0) + 1)} aria-label="Increase">+</button>
            </div>
            <span className="ol-price">{gbp(p.price)}</span>
          </div>
        ))}
        {lines.length > 0 && (
          <div className="running-total">
            <div><span className="muted">Total ({totalQty} item{totalQty === 1 ? "" : "s"})</span> <strong>{gbp(total)}</strong></div>
            <div className="muted small">Pay on collection</div>
          </div>
        )}
      </section>

      <label className="field"><span>Your name</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
      <label className="field"><span>Mobile number</span><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="07…" /></label>
      <label className="field"><span>Email (optional)</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
      <label className="field">
        <span>Notes (optional)</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, NOTES_LIMIT))} rows={2} maxLength={NOTES_LIMIT} />
        <span className="muted small">{notes.length}/{NOTES_LIMIT}</span>
      </label>

      <p className="muted small footnote">
        We use your name, mobile and (if given) email only to take and fulfil this order, and to contact you if
        anything changes. We keep order records for our normal accounting period, then delete them. To ask us to
        delete your details sooner, contact the shop with your order reference.
      </p>

      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="step-actions">
        <button className="btn" disabled={!formValid || submitting} onClick={submit}>
          {submitting ? "Placing…" : "Place order"}
        </button>
      </div>
      {date && !selectedDay?.bookable ? null : date && (
        <p className="muted small">Collection {formatDate(date)} — pay in shop, no card needed now.</p>
      )}
    </div>
  );
}
