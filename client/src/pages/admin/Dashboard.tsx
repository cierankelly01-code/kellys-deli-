import { useEffect, useState } from "react";
import { adminApi, type StatsResponse, type OrdersSummary } from "../../lib/admin";
import { gbp } from "../../lib/format";

type Period = "week" | "month" | "all";
const SRC_LABELS: Record<string, string> = {
  qr: "QR / walk-in",
  instagram: "Instagram",
  direct: "Direct",
  referral: "Referral",
};

export default function Dashboard() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("month");

  useEffect(() => {
    adminApi.stats().then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="notice danger">{error}</div>;
  if (!stats) return <p className="muted">Loading dashboard…</p>;

  const s: OrdersSummary = stats[period];

  return (
    <div>
      <div className="spread">
        <h1>Dashboard</h1>
        <div className="seg">
          {(["week", "month", "all"] as Period[]).map((p) => (
            <button key={p} className={period === p ? "active" : ""} onClick={() => setPeriod(p)}>
              {p === "week" ? "7 days" : p === "month" ? "30 days" : "All time"}
            </button>
          ))}
        </div>
      </div>

      <div className="stat-cards">
        <div className="stat-card">
          <span className="stat-label">Revenue booked</span>
          <span className="stat-value">{gbp(s.combined.revenue)}</span>
        </div>
        <div className="stat-card good">
          <span className="stat-label">Profit</span>
          <span className="stat-value">{gbp(s.combined.profit)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Orders</span>
          <span className="stat-value">{s.combined.orders}</span>
        </div>
      </div>

      <h2>By location</h2>
      <div className="card table">
        <div className="trow thead"><span>Location</span><span>Orders</span><span>Revenue</span><span>Profit</span></div>
        {s.byLocation.length === 0 && <div className="trow"><span className="muted">No orders in this period.</span></div>}
        {s.byLocation.map((l) => (
          <div className="trow" key={l.locationId}>
            <span>{l.locationName}</span>
            <span>{l.orders}</span>
            <span>{gbp(l.revenue)}</span>
            <span className="pos">{gbp(l.profit)}</span>
          </div>
        ))}
      </div>

      <h2>Lead source</h2>
      <p className="muted" style={{ marginTop: -6 }}>Where the orders are coming from — see what&apos;s working.</p>
      <div className="card table">
        <div className="trow thead"><span>Source</span><span>Orders</span><span>Revenue</span><span>Profit</span></div>
        {s.bySrc.length === 0 && <div className="trow"><span className="muted">No orders in this period.</span></div>}
        {s.bySrc.map((x) => (
          <div className="trow" key={x.src}>
            <span>{SRC_LABELS[x.src] ?? x.src}</span>
            <span>{x.orders}</span>
            <span>{gbp(x.revenue)}</span>
            <span className="pos">{gbp(x.profit)}</span>
          </div>
        ))}
      </div>

      <h2>Platters by margin</h2>
      <p className="muted" style={{ marginTop: -6 }}>Price by margin, not guesswork.</p>
      <div className="card table">
        <div className="trow thead"><span>Platter</span><span>Price</span><span>Cost</span><span>Margin</span></div>
        {stats.marginRanking.map((p) => (
          <div className="trow" key={p.id}>
            <span>{p.name}<small className="muted"> · {p.basis}</small></span>
            <span>{gbp(p.price)}</span>
            <span>{gbp(p.cost)}</span>
            <span><strong className="pos">{gbp(p.profit)}</strong> <span className="pill">{p.marginPct}%</span></span>
          </div>
        ))}
      </div>

      <WipeTestData />
    </div>
  );
}

function WipeTestData() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function wipe() {
    if (!window.confirm("Permanently delete ALL orders, bookings and customers?\n\nYour menu, prices, locations, settings and staff login are KEPT. This can't be undone.")) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await adminApi.wipeTestData();
      setMsg(`Cleared ${r.orders} orders, ${r.customers} customers, ${r.referrals} referrals. Refresh the page to see the dashboard reset.`);
    } catch (e: any) {
      setMsg("Failed: " + e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="danger-zone">
      <h2>Danger zone</h2>
      <p className="muted" style={{ marginTop: -6 }}>
        Going live? Clear out all the test orders &amp; customers. Your menu, prices, locations, settings and staff login stay.
      </p>
      {msg && <div className="notice good">{msg}</div>}
      <button className="btn danger-btn" onClick={wipe} disabled={busy} style={{ width: "auto" }}>
        {busy ? "Clearing…" : "Wipe all orders & customers"}
      </button>
    </div>
  );
}
