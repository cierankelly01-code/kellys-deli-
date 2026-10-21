import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi, type AdminOrder } from "../../lib/admin";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Top of the dashboard: what needs doing today, each one a tap away. */
export function TodayPanel() {
  const [today, setToday] = useState<AdminOrder[] | null>(null);
  const [tomorrow, setTomorrow] = useState<AdminOrder[] | null>(null);
  const [fresh, setFresh] = useState<AdminOrder[] | null>(null);

  useEffect(() => {
    const now = new Date();
    adminApi.orders({ date: iso(now) }).then(setToday).catch(() => setToday([]));
    adminApi.orders({ date: iso(new Date(now.getTime() + 86_400_000)) }).then(setTomorrow).catch(() => setTomorrow([]));
    adminApi.orders({ status: "new" }).then(setFresh).catch(() => setFresh([]));
  }, []);

  const live = (list: AdminOrder[] | null) => (list ?? []).filter((o) => o.status !== "cancelled");
  const waiting = live(today).filter((o) => !o.collectedAt && o.status !== "collected").length;

  return (
    <div className="today-panel">
      <Link className="today-tile" to="/admin/collections">
        <span className="today-num">{today === null ? "…" : waiting}</span>
        <span className="today-label">to collect today</span>
      </Link>
      <Link className="today-tile" to="/admin/collections?day=tomorrow">
        <span className="today-num">{tomorrow === null ? "…" : live(tomorrow).length}</span>
        <span className="today-label">collecting tomorrow</span>
      </Link>
      <Link className="today-tile" to="/admin/orders">
        <span className="today-num">{fresh === null ? "…" : fresh.length}</span>
        <span className="today-label">new orders to check</span>
      </Link>
      <Link className="today-tile" to="/admin/suppliers">
        <span className="today-num" aria-hidden="true">⇄</span>
        <span className="today-label">what to order from suppliers</span>
      </Link>
    </div>
  );
}
