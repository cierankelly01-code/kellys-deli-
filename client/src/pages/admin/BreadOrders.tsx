import { useEffect, useMemo, useState, useCallback } from "react";
import { api, type LocationT } from "../../lib/api";
import { adminApi } from "../../lib/admin";
import type { BreadOrderDTO, BreadOrderStatus } from "../../lib/api";
import { gbp, formatDateLong } from "../../lib/format";

const FLOW: BreadOrderStatus[] = ["pending", "confirmed", "collected"];
const STATUS_LABEL: Record<BreadOrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  collected: "Collected",
  cancelled: "Cancelled",
};

export default function BreadOrders() {
  const [locations, setLocations] = useState<LocationT[]>([]);
  const [orders, setOrders] = useState<BreadOrderDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationId, setLocationId] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => { api.locations().then(setLocations).catch(() => {}); }, []);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.bread
      .orders({ locationId: locationId || undefined, date: date || undefined, status: status || undefined, q: q.trim() || undefined })
      .then((o) => { setOrders(o); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [locationId, date, status, q]);

  useEffect(() => { load(); }, [load]);

  async function changeStatus(id: string, next: BreadOrderStatus) {
    try {
      const updated = await adminApi.bread.setOrderStatus(id, next);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (e: any) { setError(e.message); }
  }

  async function remove(o: BreadOrderDTO) {
    if (!confirm(`Permanently delete order ${o.ref} for ${o.customerName}? This can't be undone.`)) return;
    try {
      await adminApi.bread.deleteOrder(o.id);
      setOrders((prev) => prev.filter((x) => x.id !== o.id));
    } catch (e: any) { setError(e.message); }
  }

  // Grouped by collection date — orders already arrive sorted by date from the server.
  const groups = useMemo(() => {
    const out: Array<{ date: string; orders: BreadOrderDTO[] }> = [];
    for (const o of orders) {
      const g = out[out.length - 1];
      if (g && g.date === o.collectionDate) g.orders.push(o);
      else out.push({ date: o.collectionDate, orders: [o] });
    }
    return out;
  }, [orders]);

  return (
    <div>
      <h1>Bread orders</h1>

      <div className="filters">
        <select className="input" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
          <option value="">All shops</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {(["pending", "confirmed", "collected", "cancelled"] as BreadOrderStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input className="input" placeholder="Search name, mobile or ref…" value={q} onChange={(e) => setQ(e.target.value)} />
        {(locationId || date || status || q) && (
          <button className="btn-ghost" onClick={() => { setLocationId(""); setDate(""); setStatus(""); setQ(""); }}>Clear</button>
        )}
      </div>

      {error && <div className="notice danger">{error}</div>}
      {loading && <p className="muted">Loading…</p>}
      {!loading && orders.length === 0 && <p className="muted">No bread orders match.</p>}

      {groups.map((g) => (
        <div key={g.date} style={{ marginBottom: 24 }}>
          <h3>{formatDateLong(g.date)}</h3>
          <div className="stack">
            {g.orders.map((o) => (
              <div className="card order-card" key={o.id}>
                <div className="spread">
                  <div>
                    <strong>{o.ref}</strong> <span className={`pill status-${o.status}`}>{STATUS_LABEL[o.status]}</span>
                    <div className="muted">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ") || "—"}</div>
                  </div>
                  <div className="right">
                    <div>{gbp(o.total)}</div>
                    <div className="muted">{o.locationName}</div>
                  </div>
                </div>
                <div className="order-meta">
                  <span>{o.customerName} · {o.phone}{o.email ? ` · ${o.email}` : ""}</span>
                  {o.notes && <span className="notes">📝 {o.notes}</span>}
                </div>
                <div className="spread order-foot">
                  <div className="status-buttons">
                    {FLOW.map((s) => (
                      <button key={s} className={`status-btn${o.status === s ? " active" : ""}`} onClick={() => changeStatus(o.id, s)}>
                        {STATUS_LABEL[s]}
                      </button>
                    ))}
                    <button className={`status-btn cancel${o.status === "cancelled" ? " active" : ""}`} onClick={() => changeStatus(o.id, "cancelled")}>
                      Cancelled
                    </button>
                  </div>
                  <button className="btn-ghost" onClick={() => remove(o)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
