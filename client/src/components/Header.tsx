import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { boardCount, loadCart } from "../lib/cart";
import { CART_CHANGED_EVENT, openCartDrawer } from "./CartDrawer";

const ANNOUNCEMENTS = [
  "Local British produce, styled beautifully",
  "48 hours' notice for collection orders",
  "A 25% deposit confirms your order",
  "Catering for a group? Plan your event online",
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
  const location = useLocation();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(CART_CHANGED_EVENT, bump);
    return () => window.removeEventListener(CART_CHANGED_EVENT, bump);
  }, []);
  void tick;
  const cart = loadCart();
  const count = cart ? boardCount(cart) : 0;

  return (
    <>
      {/* The skip link lives in the layout (App.tsx), outside <main> — from in here
          it would only ever skip to the element containing it. */}
      <div className="deli-announcement">Good food, close to home <span aria-hidden="true">·</span> Your neighbourhood deli in Bentley Heath</div>
      <header className="hdr deli-header">
        <details className="deli-mobile-menu"><summary>Menu <span aria-hidden="true">+</span></summary><nav aria-label="Mobile navigation" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) e.currentTarget.closest("details")?.removeAttribute("open"); }}><Link to="/shop">Shop the deli</Link><Link to="/platters">Boards &amp; platters</Link><Link to="/bread">Fresh bread</Link><Link to="/plan">Gatherings &amp; events</Link><a href="/#our-shops">Visit your local deli</a></nav></details>
        <span className="deli-header-note">INDEPENDENT.<br />ALWAYS WELCOMING.</span>
        <Link to="/" className="brand">
          <span className="brand-mark">Kelly&apos;s Deli</span>
          <span className="brand-sub">Your neighbourhood delicatessen</span>
        </Link>
        <nav className="hdr-nav" aria-label="Main">
          <Link className="u-link" to="/shop">Shop the deli</Link>
          <Link className="u-link" to="/platters">Boards &amp; platters</Link>
          <Link className="u-link" to="/bread">Fresh bread</Link>
          <Link className="u-link" to="/plan">Gatherings &amp; events</Link>
          <a className="u-link" href="/#our-shops">Visit us</a>
        </nav>
        <div className="deli-header-basket">
          {location.pathname !== "/order" && (
            <button type="button" className="basket-pill" onClick={openCartDrawer} aria-label={`Your basket, ${count} board${count === 1 ? "" : "s"}`}>
              Basket ({count})
            </button>
          )}
        </div>
      </header>
    </>
  );
}
