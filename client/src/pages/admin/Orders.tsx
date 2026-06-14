import { useEffect, useState, useCallback } from "react";
import { api, type LocationT } from "../../lib/api";
import { adminApi, type AdminOrder } from "../../lib/admin";
import { gbp, formatDate } from "../../lib/format";

const STATUSES = ["new", "confirmed", "in_prep", "ready", "completed", "cancelled"];
const STATUS_LABEL: Record<string, string> = {
  new: "New",
  confirmed: "Confirmed",
  in_prep: "In Prep",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function Orders() {
  const [locations, setLocations] = useState<LocationT[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");

  useEffect(() => {
    api.locations().then(setLocations).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .orders({ location: location || undefined, date: date || undefined, status: status || undefined, type: type || undefined })
      .then((o) => {
        setOrders(o);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [location, date, status, type]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeStatus(id: string, next: string) {
    try {
      const updated = await adminApi.setStatus(id, next);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div>
      <h1>Orders</h1>

      <div className="filters">
        <select className="input" value={location} onChange={(e) => setLocation(e.target.value)}>
          <option value="">All locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          <option value="platter">Platters</option>
          <option value="gift">Gifts</option>
          <option value="experience">Tastings</option>
        </select>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        {(location || date || status || type) && (
          <button className="btn-ghost" onClick={() => { setLocation(""); setDate(""); setStatus(""); setType(""); }}>Clear</button>
        )}
      </div>

      {error && <div className="notice danger">{error}</div>}
      {loading && <p className="muted">Loading…</p>}
      {!loading && orders.length === 0 && <p className="muted">No orders match.</p>}

      <div className="stack">
        {orders.map((o) => (
          <div className="card order-card" key={o.id}>
            <div className="spread">
              <div>
                <strong>{o.ref}</strong> <span className={`pill status-${o.status}`}>{STATUS_LABEL[o.status]}</span>
                {o.type === "gift" && <span className="pill warn"> 🎁 Gift</span>}
                {o.type === "experience" && <span className="pill"> 🧀 Tasting</span>}
                <div className="muted">{(o.type === "experience" ? o.experienceName : o.platterName) ?? "—"} · {o.headcount} {o.type === "experience" ? "guests" : "ppl"}</div>
                {o.isGift && o.recipientName && <div className="muted">→ {o.recipientName}, {o.deliveryAddress}</div>}
                {o.freebie && <div className="pill good" style={{ marginTop: 4 }}>🎁 {o.freebie}</div>}
              </div>
              <div className="right">
                <div>{formatDate(o.collectionOrDeliveryDate)}</div>
                <div className="muted">{o.locationName}</div>
              </div>
            </div>
            <div className="order-meta">
              <span>{o.customerName} · {o.phone}</span>
              {o.notes && <span className="notes">📝 {o.notes}</span>}
            </div>
            <div className="spread order-foot">
              <span>
                Total <strong>{gbp(o.total)}</strong> · deposit {gbp(o.deposit)}{" "}
                <span className={`pill ${o.depositStatus === "paid" ? "" : "warn"}`}>{o.depositStatus}</span>
              </span>
              <span className="profit">profit <strong className="pos">{gbp(o.profit)}</strong></span>
            </div>
            <select className="input status-select" value={o.status} onChange={(e) => changeStatus(o.id, e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
