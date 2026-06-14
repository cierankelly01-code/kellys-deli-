import { useEffect, useState } from "react";
import { api, type LocationT } from "../../lib/api";
import { adminApi, type PrepSheetResponse } from "../../lib/admin";
import { formatDateLong } from "../../lib/format";

function todayPlus(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

export default function PrepSheet() {
  const [locations, setLocations] = useState<LocationT[]>([]);
  const [locationId, setLocationId] = useState("");
  const [date, setDate] = useState(todayPlus(2));
  const [data, setData] = useState<PrepSheetResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.locations().then((ls) => {
      setLocations(ls);
      if (ls[0]) setLocationId(ls[0].id);
    });
  }, []);

  useEffect(() => {
    if (!locationId || !date) return;
    setLoading(true);
    adminApi
      .prepSheet(locationId, date)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [locationId, date]);

  return (
    <div>
      <div className="spread no-print">
        <h1>Kitchen prep sheet</h1>
        <button className="btn" style={{ width: "auto" }} onClick={() => window.print()} disabled={!data || data.sheet.totalOrders === 0}>
          🖨 Print
        </button>
      </div>

      <div className="filters no-print">
        <select className="input" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {error && <div className="notice danger">{error}</div>}
      {loading && <p className="muted">Loading…</p>}

      {data && (
        <div className="prep-sheet">
          <div className="prep-head">
            <h2>{data.location.name}</h2>
            <p className="muted">{formatDateLong(data.date)}</p>
            <p className="prep-summary">
              {data.sheet.totalOrders} order{data.sheet.totalOrders === 1 ? "" : "s"} · {data.sheet.totalHeadcount} covers
            </p>
          </div>

          {data.sheet.totalOrders === 0 ? (
            <p className="muted">No orders for this day — nothing to prep.</p>
          ) : (
            <>
              <ul className="prep-list">
                {data.sheet.lines.map((l) => (
                  <li key={l.label}>
                    <span className="prep-qty">{l.quantity}</span>
                    <span className="prep-item">{l.label}</span>
                  </li>
                ))}
              </ul>

              <h3 className="no-print">Platters</h3>
              <div className="prep-platters">
                {data.sheet.byPlatter.map((p) => (
                  <span key={p.platterName} className="pill">{p.orders}× {p.platterName}</span>
                ))}
              </div>

              <h3>Orders</h3>
              <ul className="prep-orders">
                {data.orders.map((o) => (
                  <li key={o.ref}>
                    <strong>{o.ref}</strong> — {o.platterName} ({o.headcount}) · {o.customerName}
                    <span className={`pill status-${o.status}`}>{o.status}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
