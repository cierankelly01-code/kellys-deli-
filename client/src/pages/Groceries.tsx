import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type GroceryAvailabilityResponse, type GroceryOrderDTO, type GroceryProductT, type LocationT } from "../lib/api";
import { gbp, formatDate, formatDateLong } from "../lib/format";
import { BreadCalendar, unavailableReason } from "../components/BreadCalendar";
import { monthStart, daysInMonth } from "../components/CapacityCalendar";
import { Header } from "../components/Header";
import { usePageTitle } from "../lib/title";

const NOTES_LIMIT = 200;

// Display labels for GroceryProduct.department — free text in the DB (admin-managed,
// same convention as Platter.category), mapped here for presentation only.
const DEPARTMENT_LABELS: Record<string, string> = {
  sandwiches: "Sandwiches",
  "open-sandwiches": "Open Sandwiches",
  salads: "Salads",
  salami: "Salami",
  meats: "Deli Meats",
  quiches: "Quiches",
  cheese: "Cheese",
  pies: "Pies",
  tubs: "Tubs & Dips",
  savoury: "Savoury Bakes",
  pantry: "Pantry",
  cakes: "Cakes & Sweet",
};

function departmentLabel(key: string): string {
  return DEPARTMENT_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

export default function Groceries() {
  usePageTitle("Groceries");

  const [locations, setLocations] = useState<LocationT[]>([]);
  const [locationId, setLocationId] = useState("");
  const [products, setProducts] = useState<GroceryProductT[] | null>(null);
  const [limits, setLimits] = useState({ minOrderQty: 1, maxItemQty: 20 });
  const [availability, setAvailability] = useState<GroceryAvailabilityResponse | null>(null);
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
  const [confirmed, setConfirmed] = useState<GroceryOrderDTO | null>(null);

  useEffect(() => {
    Promise.all([api.locations(), api.groceries.orderLimits()])
      .then(([ls, lim]) => {
        setLocations(ls);
        setLimits(lim);
        if (ls[0]) setLocationId((prev) => prev || ls[0].id);
      })
      .catch(() => setLoadError("Couldn't load our shops. Please try again."));
  }, []);

  useEffect(() => {
    if (!locationId) return;
    setProducts(null);
    api.groceries.products(locationId).then(setProducts).catch(() => setProducts([]));
  }, [locationId]);

  // Availability follows the chosen shop AND the month on show, same paging as the board calendar.
  useEffect(() => {
    if (!locationId) return;
    setAvailability(null);
    const today = new Date().toISOString().slice(0, 10);
    const from = calMonth.slice(0, 7) === today.slice(0, 7) ? today : calMonth;
    const span = daysInMonth(calMonth) - (Number(from.slice(8, 10)) - 1) + 1;
    api.groceries.availability(locationId, from, span).then(setAvailability).catch(() => setAvailability(null));
  }, [locationId, calMonth]);

  // Changing shop invalidates the picked date and quantities (different menu, different calendar).
  function changeLocation(next: string) {
    setLocationId(next);
    setDate(null);
    setQuantities({});
  }

  function setQty(productId: string, qty: number) {
    const clamped = Math.max(0, Math.min(limits.maxItemQty, qty));
    setQuantities((prev) => ({ ...prev, [productId]: clamped }));
  }

  const grouped = useMemo(() => {
    const map = new Map<string, GroceryProductT[]>();
    for (const p of products ?? []) {
      const list = map.get(p.department) ?? [];
      list.push(p);
      map.set(p.department, list);
    }
    return Array.from(map.entries());
  }, [products]);

  const lines = useMemo(
    () => (products ?? []).map((p) => ({ product: p, quantity: quantities[p.id] ?? 0 })).filter((l) => l.quantity > 0),
    [products, quantities],
  );
  const totalQty = lines.reduce((s, l) => s + l.quantity, 0);
  const total = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);

  const selectedLocation = locations.find((l) => l.id === locationId) ?? null;
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
      const res = await api.groceries.createOrder({
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
          <h1>Your order&apos;s ready to collect!</h1>
          <p className="confirm-collection">Collection <strong>{formatDateLong(confirmed.collectionDate)}</strong> — {confirmed.locationName}</p>
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
    <div className="app app-wide">
      <Header />

      <header
        className="cat-hero"
        style={{ backgroundImage: "url(/images/groceries-counter.webp)" }}
      >
        <video src="/videos/hero-counter.mp4" poster="/images/groceries-counter.webp" autoPlay loop muted playsInline />
        <div className="cat-hero-scrim">
          <h1 className="cat-hero-h">Groceries</h1>
          <p className="cat-hero-tag">Sandwiches, salads, pies, cheese and more — click &amp; collect</p>
        </div>
      </header>
      <p className="cat-desc">
        Everything from the deli counter, ready for click &amp; collect — minimum {limits.minOrderQty > 1 ? `${limits.minOrderQty} items, ` : ""}24 hours' notice.
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

      {products === null && <p className="muted center">Loading our shop…</p>}

      {products !== null && grouped.length === 0 && (
        <p className="muted center" role="status">
          Our full shop range is on its way — check back soon{selectedLocation?.phone ? `, or call us on ${selectedLocation.phone}` : ""}.
        </p>
      )}

      {grouped.length > 1 && (
        <nav className="dept-nav" aria-label="Jump to department">
          {grouped.map(([department]) => (
            <a key={department} href={`#dept-${department}`} className="dept-nav-chip">{departmentLabel(department)}</a>
          ))}
        </nav>
      )}

      {grouped.map(([department, items]) => (
        <section key={department} id={`dept-${department}`} className="board-section dept-section" style={{ marginTop: 24 }}>
          <h2 className="section-h">{departmentLabel(department)}</h2>
          <div className="board-grid">
            {items.map((p) => (
              <article key={p.id} className="board-card card">
                <div className="deli-product-image">
                  {p.imageUrl
                    ? <img className="board-card-img" src={p.imageUrl} alt={p.name} width="640" height="480" loading="lazy" />
                    : <span className="deli-image-placeholder">Kelly’s Deli<br /><small>{p.name}</small></span>}
                </div>
                <div className="board-card-body">
                  <h3 className="board-card-name">{p.name}</h3>
                  {p.description && <p className="muted" style={{ marginTop: 4 }}>{p.description}</p>}
                  <p className="board-card-price">{gbp(p.price)}{p.unitLabel ? ` · ${p.unitLabel}` : ""}</p>
                  <div className="stepper" role="group" aria-label={`${p.name} quantity`} style={{ marginTop: 8 }}>
                    <button type="button" onClick={() => setQty(p.id, (quantities[p.id] ?? 0) - 1)} aria-label="Decrease">−</button>
                    <span className="stepper-val">{quantities[p.id] ?? 0}</span>
                    <button type="button" onClick={() => setQty(p.id, (quantities[p.id] ?? 0) + 1)} aria-label="Increase">+</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      {grouped.length > 0 && (
        <div className="checkout-panel">
          {lines.length > 0 && (
            <div className="running-total" style={{ marginTop: 24 }}>
              <div><span className="muted">Basket ({totalQty} item{totalQty === 1 ? "" : "s"})</span> <strong>{gbp(total)}</strong></div>
              <div className="muted small">Pay on collection</div>
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
              <button className="btn" disabled={!formValid || submitting || totalQty === 0} onClick={submit}>
                {submitting ? "Placing…" : totalQty === 0 ? "Add items to order" : "Place order"}
              </button>
            </div>
            {date && selectedDay?.bookable && (
              <p className="muted small">Collection {formatDate(date)} — pay in shop, no card needed now.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
