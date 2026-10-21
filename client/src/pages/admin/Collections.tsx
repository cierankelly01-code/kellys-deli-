import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { adminApi, type AdminOrder } from "../../lib/admin";
import { gbp, formatDate } from "../../lib/format";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (dateStr: string, n: number) => iso(new Date(new Date(`${dateStr}T12:00:00Z`).getTime() + n * 86_400_000));

/**
 * The counter list: who's collecting on a day, searchable by name, phone or reference,
 * with one big tick per order. Built for a phone in one hand during the Christmas rush.
 */
export default function Collections() {
  const [params] = useSearchParams();
  const today = iso(new Date());
  const [date, setDate] = useState(params.get("day") === "tomorrow" ? addDays(today, 1) : today);
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setOrders(null);
    adminApi
      .orders({ date })
      .then((o) => { setOrders(o.filter((x) => x.status !== "cancelled")); setError(null); })
      .catch((e) => { setError(e.message); setOrders([]); });
  }, [date]);
  useEffect(load, [load]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = (orders ?? []).filter(
      (o) => !needle || [o.ref, o.customerName, o.phone, o.email].some((f) => f?.toLowerCase().includes(needle)),
    );
    // Still to collect first, then collected; alphabetical within each.
    return list.sort((a, b) => Number(!!a.collectedAt) - Number(!!b.collectedAt) || a.customerName.localeCompare(b.customerName));
  }, [orders, q]);

  const done = (orders ?? []).filter((o) => o.collectedAt).length;

  async function toggle(o: AdminOrder) {
    setBusy(o.id);
    try {
      const updated = await adminApi.setCollected(o.id, !o.collectedAt);
      setOrders((prev) => (prev ?? []).map((x) => (x.id === updated.id ? updated : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update that order");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="collections">
      <h1>Collections</h1>
      <div className="collect-day">
        <button className="btn-ghost" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">‹</button>
        <input className="input" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <button className="btn-ghost" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">›</button>
        {date !== today && <button className="btn-ghost" onClick={() => setDate(today)}>Today</button>}
      </div>
      <input
        className="input collect-search"
        type="search"
        placeholder="Search name, phone or KD- reference"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search collections"
      />
      {orders && (
        <p className="muted collect-count" role="status">
          {formatDate(date)} · {orders.length} order{orders.length === 1 ? "" : "s"} · <strong>{done} collected</strong>, {orders.length - done} to go
        </p>
      )}
      {error && <div className="notice danger">{error}</div>}
      {!orders && <p className="muted">Loading…</p>}
      {orders && orders.length === 0 && <p className="muted">Nobody&apos;s collecting on this day.</p>}

      <div className="stack">
        {shown.map((o) => {
          const lines = o.items.length > 0 ? o.items.map((i) => `${i.quantity}× ${i.platterName ?? "item"}`) : o.platterName ? [o.platterName] : [];
          const owed = o.depositStatus === "paid" ? o.balance : o.total;
          return (
            <div key={o.id} className={`card collect-card${o.collectedAt ? " is-done" : ""}`}>
              <div className="collect-info">
                <div className="collect-name"><strong>{o.customerName}</strong> <span className="muted">{o.ref}</span></div>
                <ul className="collect-lines">
                  {lines.map((l) => <li key={l}>{l}</li>)}
                  {o.addOns.map((a) => <li key={a.id} className="muted">{a.quantity}× {a.name}</li>)}
                </ul>
                {o.notes && <p className="collect-notes">📝 {o.notes}</p>}
                <p className="collect-money">
                  {owed > 0
                    ? <span className="pill warn">Take {gbp(owed)} at the counter</span>
                    : <span className="pill good">Paid in full</span>}
                  {" "}<a href={`tel:${o.phone}`} className="muted">{o.phone}</a>
                </p>
              </div>
              <button
                className={`collect-tick${o.collectedAt ? " on" : ""}`}
                onClick={() => toggle(o)}
                disabled={busy === o.id}
                aria-pressed={!!o.collectedAt}
                aria-label={o.collectedAt ? `Undo collected for ${o.customerName}` : `Mark ${o.customerName} collected`}
              >
                {o.collectedAt ? "✓" : ""}
                <span>{o.collectedAt ? "Collected" : "Collect"}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
