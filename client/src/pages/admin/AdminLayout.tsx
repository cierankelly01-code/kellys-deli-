import { useEffect, useState } from "react";
import { NavLink, Outlet, Navigate, useLocation, useNavigate } from "react-router-dom";
import { auth } from "../../lib/admin";

// Grouped so the phone "More" sheet reads like a menu, not a wall of 17 links.
const NAV_GROUPS: Array<{ title: string; links: Array<{ to: string; label: string; end?: boolean }> }> = [
  {
    title: "Daily",
    links: [
      { to: "/admin", label: "Dashboard", end: true },
      { to: "/admin/collections", label: "Collections" },
      { to: "/admin/orders", label: "Orders" },
      { to: "/admin/suppliers", label: "Supplier orders" },
      { to: "/admin/prep", label: "Prep Sheet" },
    ],
  },
  {
    title: "Shop",
    links: [
      { to: "/admin/menu", label: "Menu & Pricing" },
      { to: "/admin/categories", label: "Categories" },
      { to: "/admin/bundles", label: "Bundles" },
      { to: "/admin/add-ons", label: "Add-ons" },
      { to: "/admin/recommender", label: "Recommender" },
    ],
  },
  {
    title: "Bread",
    links: [
      { to: "/admin/bread", label: "Bread Orders", end: true },
      { to: "/admin/bread/bake-sheet", label: "Bake Sheet" },
      { to: "/admin/bread/settings", label: "Bread Settings" },
    ],
  },
  {
    title: "Customers & settings",
    links: [
      { to: "/admin/enquiries", label: "Enquiries" },
      { to: "/admin/sms", label: "SMS List" },
      { to: "/admin/fill-slots", label: "Fill Slots" },
      { to: "/admin/settings", label: "Site Settings" },
    ],
  },
];
const NAV = NAV_GROUPS.flatMap((g) => g.links);

// The four things done most from a phone at the counter, always one tap away.
const TABS: Array<{ to: string; label: string; icon: string; end?: boolean }> = [
  { to: "/admin", label: "Today", icon: "◉", end: true },
  { to: "/admin/collections", label: "Collect", icon: "✓" },
  // "All orders", not "Orders": the strip above also has an "Orders" link on phones.
  { to: "/admin/orders", label: "All orders", icon: "☰" },
  { to: "/admin/suppliers", label: "Suppliers", icon: "⇄" },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => setMoreOpen(false), [location.pathname]);
  // The storefront's seasonal skin is for customers; staff screens stay in house colours.
  useEffect(() => {
    delete document.documentElement.dataset.season;
  }, []);
  useEffect(() => {
    if (!moreOpen) return;
    document.querySelector<HTMLElement>("#admin-more a")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMoreOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [moreOpen]);
  if (!auth.isAuthed) return <Navigate to="/admin/login" replace />;

  const logout = () => {
    auth.clear();
    navigate("/admin/login");
  };

  return (
    <div className="admin">
      <header className="admin-top">
        <span className="brand-mark">Kelly&apos;s Deli</span>
        <span className="admin-tag">Staff</span>
        <a className="btn-ghost admin-viewsite" href="/" target="_blank" rel="noreferrer">View site</a>
        <button className="btn-ghost logout" onClick={logout}>Log out</button>
      </header>
      <nav className="admin-nav" aria-label="Admin">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? "active" : "")}>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <main className="admin-main">
        <Outlet />
      </main>

      {/* Phone: bottom tab bar + a "More" sheet with everything else. */}
      <nav className="admin-tabbar" aria-label="Admin quick links">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `admin-tab${isActive ? " active" : ""}`}>
            <span className="admin-tab-icon" aria-hidden="true">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
        <button type="button" className={`admin-tab${moreOpen ? " active" : ""}`} aria-expanded={moreOpen} aria-controls="admin-more" onClick={() => setMoreOpen((o) => !o)}>
          <span className="admin-tab-icon" aria-hidden="true">⋯</span>
          More
        </button>
      </nav>
      {moreOpen && (
        <div className="admin-more" id="admin-more" role="dialog" aria-modal="true" aria-label="All admin pages" onClick={(e) => { if (e.target === e.currentTarget) setMoreOpen(false); }}>
          <div className="admin-more-sheet">
            {NAV_GROUPS.map((g) => (
              <div key={g.title} className="admin-more-group">
                <p className="admin-more-title">{g.title}</p>
                {g.links.map((n) => (
                  <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? "active" : "")}>
                    {n.label}
                  </NavLink>
                ))}
              </div>
            ))}
            <button className="btn-ghost" onClick={logout}>Log out</button>
          </div>
        </div>
      )}
    </div>
  );
}
