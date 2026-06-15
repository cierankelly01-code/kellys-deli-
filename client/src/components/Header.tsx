import { Link } from "react-router-dom";

export function Header() {
  return (
    <header className="hdr spread">
      <Link to="/" className="brand">
        <span className="brand-mark">Kelly&apos;s Deli</span>
        <span className="brand-sub">Family Deli</span>
      </Link>
      <Link to="/admin" className="staff-link">Staff</Link>
    </header>
  );
}
