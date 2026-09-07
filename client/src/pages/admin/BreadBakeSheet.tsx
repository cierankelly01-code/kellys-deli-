import { useEffect, useState } from "react";
import { api, type LocationT } from "../../lib/api";
import { adminApi, type BreadBakeSheetResponse } from "../../lib/admin";
import { formatDateLong } from "../../lib/format";

function todayPlus(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

const STATUS_LABEL: Record<string, string> = { pending: "Pending", confirmed: "Confirmed", collected: "Collected", cancelled: "Cancelled" };

export default function BreadBakeSheet() {
  const [locations, setLocations] = useState<LocationT[]>([]);
  const [locationId, setLocationId] = useState(""); // "" = all shops
  const [date, setDate] = useState(todayPlus(2));
  const [data, setData] = useState<BreadBakeSheetResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.locations().then(setLocations).catch(() => {}); }, []);

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    adminApi.bread
      .bakeSheet(date, locationId || undefined)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [locationId, date]);

  const totalOrders = data?.shops.reduce((s, shop) => s + shop.sheet.totalOrders, 0) ?? 0;

  return (
    <div>
      <div className="spread no-print">
        <h1>Bake Sheet</h1>
        <button className="btn" style={{ width: "auto" }} onClick={() => window.print()} disabled={!data || totalOrders === 0}>
          🖨 Print
        </button>
      </div>

      <div className="filters no-print">
        <select className="input" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
          <option value="">All shops</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {error && <div className="notice danger">{error}</div>}
      {loading && <p className="muted">Loading…</p>}

      {data && (
        <div className="prep-sheet">
          <div className="prep-head">
            <p className="muted">{formatDateLong(data.date)}</p>
          </div>

          {totalOrders === 0 ? (
            <p className="muted">No bread orders for this day.</p>
          ) : (
            data.shops.map((shop) => (
              <div key={shop.location.id} style={{ marginBottom: 28 }}>
                <h2 style={{ marginBottom: 2 }}>{shop.location.name}</h2>
                <p className="prep-summary">
                  {shop.sheet.totalOrders} order{shop.sheet.totalOrders === 1 ? "" : "s"} · {shop.sheet.totalItems} item{shop.sheet.totalItems === 1 ? "" : "s"}
                </p>

                {shop.sheet.totalOrders === 0 ? (
                  <p className="muted">Nothing to bake here today.</p>
                ) : (
                  <>
                    <ul className="prep-list">
                      {shop.sheet.lines.map((l) => (
                        <li key={l.name}>
                          <span className="prep-qty">{l.quantity}</span>
                          <span className="prep-item">{l.name}</span>
                        </li>
                      ))}
                    </ul>

                    <h3>Orders</h3>
                    <ul className="prep-orders">
                      {shop.sheet.orders.map((o) => (
                        <li key={o.ref}>
                          <strong>{o.ref}</strong> — {o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")} · {o.customerName}
                          <span className={`pill status-${o.status}`}>{STATUS_LABEL[o.status] ?? o.status}</span>
                          {o.notes && <span className="notes">📝 {o.notes}</span>}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
