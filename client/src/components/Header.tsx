import { Link } from "react-router-dom";

const ANNOUNCEMENTS = [
  "Local British produce, styled beautifully",
  "48 hours' notice for delivery orders",
  "£25 deposit secures your board",
  "Ask in-store about our seasonal boards",
];

export function Ticker() {
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {[...ANNOUNCEMENTS, ...ANNOUNCEMENTS].map((t, i) => (
          <span className="ticker-item" key={i}>{t}</span>
        ))}
      </div>
    </div>
  );
}

export function Header() {
  return (
    <>
      <Ticker />
      <header className="hdr spread">
        <Link to="/" className="brand">
          <span className="brand-mark">Kelly&apos;s Deli</span>
          <span className="brand-sub">Family Deli</span>
        </Link>
        <Link to="/admin" className="staff-link">Staff</Link>
      </header>
    </>
  );
}
