import { useEffect, useState } from "react";
import { adminApi, type SupplierSheetResponse } from "../../lib/admin";
import { gbp, formatDate } from "../../lib/format";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * What to order from each supplier, rolled up from customers' orders. Sell first, buy
 * second: the owner works down this list instead of guessing stock.
 */
export default function SupplierSheet() {
  const [from, setFrom] = useState(iso(new Date()));
  const [to, setTo] = useState(iso(new Date(Date.now() + 30 * 86_400_000)));
  const [data, setData] = useState<SupplierSheetResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    adminApi.supplierSheet(from, to).then((d) => { setData(d); setError(null); }).catch((e) => setError(e.message));
  }, [from, to]);

  /** Plain-text order for a supplier — paste into an email, WhatsApp or their order form. */
  async function copyOrder(g: SupplierSheetResponse["groups"][number]) {
    const text = [
      `Order from Kelly's Deli`,
      ...g.products.map((p) => `${p.quantity} × ${p.name}${p.unitLabel ? ` (${p.unitLabel})` : ""}${p.sku ? ` — code ${p.sku}` : ""}`),
      ``,
      `Needed by ${formatDate(g.products.reduce((m, p) => (p.firstCollection < m ? p.firstCollection : m), g.products[0].firstCollection))}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(g.supplier);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt("Copy this order:", text);
    }
  }

  return (
    <div className="supplier-sheet">
      <h1>Supplier orders</h1>
      <p className="muted">
        Everything customers have ordered for collection between these dates, grouped by who you buy it from.
        Unpaid online orders aren&apos;t counted — you never buy stock for a basket nobody paid for.
      </p>
      <div className="filters">
        <label className="field-inline">From <input className="input" type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} /></label>
        <label className="field-inline">To <input className="input" type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} /></label>
      </div>
      {error && <div className="notice danger">{error}</div>}
      {!data && !error && <p className="muted">Loading…</p>}
      {data && (
        <p className="muted" role="status">
          {data.orderCount} order{data.orderCount === 1 ? "" : "s"} counted
          {data.awaitingPayment > 0 && <> · {data.awaitingPayment} waiting on payment (not counted)</>}
        </p>
      )}
      {data && data.groups.length === 0 && <p className="muted">Nothing to order for these dates yet.</p>}

      <div className="stack">
        {data?.groups.map((g) => (
          <section key={g.supplier} className={`card supplier-group${g.inHouse ? " in-house" : ""}`}>
            <div className="spread supplier-head">
              <div>
                <h2>{g.supplier}</h2>
                {!g.inHouse && <p className="supplier-due">Order by <strong>{formatDate(g.orderFromSupplierBy)}</strong> · est. cost {gbp(g.estCost)}</p>}
              </div>
              {!g.inHouse && (
                <button className="btn" onClick={() => copyOrder(g)}>{copied === g.supplier ? "Copied ✓" : "Copy order"}</button>
              )}
            </div>
            <ul className="supplier-lines">
              {g.products.map((p) => (
                <li key={p.platterId}>
                  <span className="supplier-qty">{p.quantity}×</span>
                  <span className="supplier-name">
                    {p.url ? <a href={p.url} target="_blank" rel="noreferrer">{p.name}</a> : p.name}
                    {p.unitLabel && <span className="muted"> · {p.unitLabel}</span>}
                    {p.sku && <span className="muted"> · code {p.sku}</span>}
                    <span className="muted small supplier-refs">
                      first collection {formatDate(p.firstCollection)} · {p.orderRefs.length} order{p.orderRefs.length === 1 ? "" : "s"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
