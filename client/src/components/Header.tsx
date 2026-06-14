import { Link } from "react-router-dom";

export function Header() {
  return (
    <header className="hdr">
      <Link to="/" className="brand">
        <span className="brand-mark">Kelly&apos;s Deli</span>
        <span className="brand-sub">Family Deli</span>
      </Link>
    </header>
  );
}
