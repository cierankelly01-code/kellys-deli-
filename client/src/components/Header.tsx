import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { boardCount, loadCart } from "../lib/cart";
import { CART_CHANGED_EVENT } from "./CartDrawer";

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
  const showBasket = count > 0 && location.pathname !== "/order";

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Ticker />
      <header className="hdr spread">
        <Link to="/" className="brand">
          <span className="brand-mark">Kelly&apos;s Deli</span>
          <span className="brand-sub">Family Deli</span>
        </Link>
        <nav className="hdr-nav" aria-label="Main">
          <Link className="u-link" to="/platters">Boards</Link>
          <Link className="u-link" to="/plan">Plan an event</Link>
          {showBasket && (
            <Link className="basket-pill" to="/order" aria-label={`Your basket, ${count} board${count === 1 ? "" : "s"}`}>
              Basket · {count}
            </Link>
          )}
        </nav>
      </header>
    </>
  );
}
