import { useEffect, useState, useCallback } from "react";
import { api, type LocationT } from "../../lib/api";
import { adminApi, type AdminOrder } from "../../lib/admin";
import { gbp, formatDate } from "../../lib/format";

// v2 manual staff flow. cancelled is offered separately.
const FLOW = ["new", "deposit_requested", "confirmed", "collected"];
const STATUSES = [...FLOW, "cancelled"];
const STATUS_LABEL: Record<string, string> = {
  new: "New",
  deposit_requested: "Deposit requested",
  confirmed: "Confirmed",
  collected: "Collected",
  cancelled: "Cancelled",
  // legacy values tolerated on old rows
  in_prep: "In Prep",
  ready: "Ready",
  completed: "Completed",
};

export default function Orders() {
  const [locations, setLocations] = useState<LocationT[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    api.locations().then(setLocations).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .orders({ location: location || undefined, date: date || undefined, status: status || undefined })
      .then((o) => { setOrders(o); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [location, date, status]);

  useEffect(() => { load(); }, [load]);

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
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        {(location || date || status) && (
          <button className="btn-ghost" onClick={() => { setLocation(""); setDate(""); setStatus(""); }}>Clear</button>
        )}
      </div>

      {error && <div className="notice danger">{error}</div>}
      {loading && <p className="muted">Loading…</p>}
      {!loading && orders.length === 0 && <p className="muted">No orders match.</p>}

      <div className="stack">
        {orders.map((o) => {
          const boardItems = o.items.length > 0
            ? o.items.map((i) => `${i.quantity}× ${i.platterName ?? "board"}`)
            : o.platterName ? [`${o.quantity ?? 1}× ${o.platterName}`] : [];
          return (
            <div className="card order-card" key={o.id}>
              <div className="spread">
                <div>
                  <strong>{o.ref}</strong> <span className={`pill status-${o.status}`}>{STATUS_LABEL[o.status] ?? o.status}</span>
                  {o.occasion && <span className="pill"> {o.occasion}</span>}
                  {o.isSubscription && <span className="pill recurring-badge">Recurring · {o.subscriptionFrequency}</span>}
                  <div className="muted">{boardItems.join(", ") || "—"} · {o.headcount} ppl</div>
                  {o.addOns.length > 0 && (
                    <div className="muted">+ {o.addOns.map((a) => `${a.quantity}× ${a.name}`).join(", ")}</div>
                  )}
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
                  Total <strong>{gbp(o.total)}</strong> · deposit due (25%) {gbp(o.deposit)}{" "}
                  <span className={`pill ${o.depositStatus === "paid" ? "" : "warn"}`}>{o.depositStatus}</span>
                  {" "}· balance {gbp(o.balance)}
                </span>
                <span className="profit">profit <strong className="pos">{gbp(o.profit)}</strong></span>
              </div>
              <div className="status-buttons">
                {FLOW.map((s) => (
                  <button
                    key={s}
                    className={`status-btn${o.status === s ? " active" : ""}`}
                    onClick={() => changeStatus(o.id, s)}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
                <button
                  className={`status-btn cancel${o.status === "cancelled" ? " active" : ""}`}
                  onClick={() => changeStatus(o.id, "cancelled")}
                >
                  Cancelled
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
