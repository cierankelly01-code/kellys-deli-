import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { boardCount, loadCart } from "../lib/cart";
import { CART_CHANGED_EVENT, openCartDrawer } from "./CartDrawer";
import { useSeason, loadSiteContent } from "../lib/season";
import { openStatus, parseHours } from "../lib/hours";

/* The site header: a slim utility bar (live opening hours + the seasonal message), then the
 * green brand bar with the wordmark on the left, the department nav with a "Shop" mega-menu,
 * and the basket. On phones the nav moves into a full-screen menu. */

type NavLink = { to: string; label: string };
type Column = { title: string; links: NavLink[] };

const SHOP_COLUMNS: Column[] = [
  {
    title: "The Christmas Collection",
    links: [
      { to: "/christmas", label: "Shop all Christmas" },
      { to: "/christmas#xs-hams-and-joints", label: "Hams & joints" },
      { to: "/christmas#xs-turkey-and-trimmings", label: "Turkey & trimmings" },
      { to: "/christmas#xs-party-food", label: "Party food" },
      { to: "/christmas#xs-cheese", label: "Cheese" },
      { to: "/christmas#xs-hampers-and-gifts", label: "Hampers & gifts" },
    ],
  },
  {
    title: "From the deli",
    links: [
      { to: "/platters", label: "Boards & platters" },
      { to: "/shop", label: "Shop by occasion" },
      { to: "/shop/at-home", label: "Boards for a night in" },
      { to: "/bread", label: "Fresh bread" },
    ],
  },
  {
    title: "Catering",
    links: [
      { to: "/plan", label: "Plan an event" },
      { to: "/shop/hosting", label: "Hosting a crowd" },
      { to: "/shop/office-corporate", label: "Office & corporate" },
    ],
  },
];

// Kept short and stable: the e2e audit expects these routes reachable from every page.
const PRIMARY: NavLink[] = [
  { to: "/platters", label: "Boards & platters" },
  { to: "/plan", label: "Catering" },
  { to: "/bread", label: "Fresh bread" },
];

/** The basket count, kept in step with every add/remove anywhere on the page. */
function useBasketCount(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(CART_CHANGED_EVENT, bump);
    window.addEventListener("focus", bump);
    return () => {
      window.removeEventListener(CART_CHANGED_EVENT, bump);
      window.removeEventListener("focus", bump);
    };
  }, []);
  void tick;
  const cart = loadCart();
  return cart ? boardCount(cart) : 0;
}

export function Header() {
  const location = useLocation();
  const count = useBasketCount();
  const { season, banner } = useSeason();
  const xmas = season === "christmas";
  const [hoursText, setHoursText] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSiteContent().then((c) => {
      const h = parseHours(c?.openingHours);
      if (h) setHoursText(openStatus(h).text);
    });
  }, []);

  // Close the phone menu on navigation; lock scroll + Escape while it's open.
  useEffect(() => setMenuOpen(false), [location.pathname, location.hash]);
  useEffect(() => {
    if (!menuOpen) return;
    document.body.style.overflow = "hidden";
    menuRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const basketLabel = `Your basket, ${count} board${count === 1 ? "" : "s"}`;

  // The one bit of motion on the site: the basket count ticks when something is added.
  const lastCount = useRef(count);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (count > lastCount.current) setTick((t) => t + 1);
    lastCount.current = count;
  }, [count]);

  return (
    <>
      <div className="utility-bar">
        <span className="utility-left">{hoursText ? `Bentley Heath: ${hoursText.replace(" · ", ", ")}` : "Bentley Heath, Solihull"}</span>
        {xmas ? (
          <Link to="/christmas" className="utility-centre season-banner">
            <span className="season-banner-text">{banner}</span> <span className="season-banner-cta">Order now</span>
          </Link>
        ) : (
          <span className="utility-centre">Order online, collect from the shop in Bentley Heath.</span>
        )}
        <a className="utility-right" href="#our-shops">Visit the shop</a>
      </div>

      <header className="site-header">
        <div className="site-header-row">
          <Link to="/" className="brand" aria-label="Kelly's Deli — home">
            <span className="brand-mark">Kelly&apos;s</span>
            <span className="brand-sub">Deli, Bentley Heath</span>
          </Link>

          <nav className="site-nav" aria-label="Main">
            {xmas && <Link className="site-nav-link nav-season" to="/christmas">Christmas</Link>}
            <div className="site-nav-item has-mega">
              <Link className="site-nav-link" to="/shop" aria-haspopup="true">Shop</Link>
              <div className="mega" role="group" aria-label="Shop departments">
                <div className="mega-inner">
                  {SHOP_COLUMNS.filter((c) => xmas || !c.title.includes("Christmas")).map((col) => (
                    <div className="mega-col" key={col.title}>
                      <p className="mega-title">{col.title}</p>
                      {col.links.map((l) => <Link key={l.to} to={l.to}>{l.label}</Link>)}
                    </div>
                  ))}
                  <div className="mega-feature">
                    <p className="mega-feature-h">Feeding a crowd?</p>
                    <p>Tell us how many and we&apos;ll put the spread together.</p>
                    <Link className="mega-feature-link" to="/plan">Plan an event</Link>
                  </div>
                </div>
              </div>
            </div>
            {PRIMARY.map((l) => <Link key={l.to} className="site-nav-link" to={l.to}>{l.label}</Link>)}
            <a className="site-nav-link" href="#our-shops">Visit us</a>
          </nav>

          <div className="header-actions">
            {location.pathname !== "/order" && (
              <button type="button" className="basket-pill" onClick={openCartDrawer} aria-label={basketLabel}>
                <span className="basket-pill-text">Basket</span>
                <span key={tick} className={`basket-pill-count${tick ? " is-tick" : ""}`}>{count}</span>
              </button>
            )}
            <button
              type="button"
              className="header-menu-btn"
              aria-expanded={menuOpen}
              aria-controls="site-menu"
              aria-label="Menu"
              onClick={() => setMenuOpen(true)}
            >
              <span className="header-menu-icon" aria-hidden="true"><i /><i /><i /></span>
              <span className="header-menu-word">Menu</span>
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="site-menu" id="site-menu" role="dialog" aria-modal="true" aria-label="Menu" ref={menuRef}>
          <div className="site-menu-head">
            <span className="site-menu-word" aria-hidden="true">Kelly&apos;s</span>
            <button type="button" className="site-menu-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">Close</button>
          </div>
          <nav className="site-menu-nav" aria-label="Mobile navigation">
            {xmas && <Link className="site-menu-big nav-season" to="/christmas">Christmas</Link>}
            {SHOP_COLUMNS.filter((c) => xmas || !c.title.includes("Christmas")).map((col) => (
              <details key={col.title} className="site-menu-group" open={col.title === "From the deli"}>
                <summary>{col.title}</summary>
                {col.links.map((l) => <Link key={l.to} to={l.to}>{l.label}</Link>)}
              </details>
            ))}
            <a className="site-menu-big" href="#our-shops" onClick={() => setMenuOpen(false)}>Visit the shop</a>
          </nav>
          {hoursText && <p className="site-menu-hours">Bentley Heath: {hoursText.replace(" · ", ", ")}</p>}
        </div>
      )}
    </>
  );
}
