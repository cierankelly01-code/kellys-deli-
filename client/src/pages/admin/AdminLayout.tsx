import { NavLink, Outlet, Navigate, useNavigate } from "react-router-dom";
import { auth } from "../../lib/admin";

// Grouped so the strip reads as sections, not one long flat list of 15+ links.
const NAV_GROUPS: Array<{ label: string; links: Array<{ to: string; label: string; end?: boolean }> }> = [
  {
    label: "Overview",
    links: [
      { to: "/admin", label: "Dashboard", end: true },
      { to: "/admin/orders", label: "Orders" },
      { to: "/admin/prep", label: "Prep Sheet" },
      { to: "/admin/fill-slots", label: "Fill Slots" },
    ],
  },
  {
    label: "Catalogue",
    links: [
      { to: "/admin/menu", label: "Menu & Pricing" },
      { to: "/admin/categories", label: "Categories" },
      { to: "/admin/bundles", label: "Bundles" },
      { to: "/admin/add-ons", label: "Add-ons" },
      { to: "/admin/recommender", label: "Recommender" },
    ],
  },
  {
    label: "Bread",
    links: [
      { to: "/admin/bread", label: "Orders" },
      { to: "/admin/bread/bake-sheet", label: "Bake Sheet" },
      { to: "/admin/bread/settings", label: "Settings" },
    ],
  },
  {
    label: "Groceries",
    links: [
      { to: "/admin/groceries", label: "Orders" },
      { to: "/admin/groceries/settings", label: "Settings" },
    ],
  },
  {
    label: "Comms & Settings",
    links: [
      { to: "/admin/enquiries", label: "Enquiries" },
      { to: "/admin/sms", label: "SMS List" },
      { to: "/admin/settings", label: "Site Settings" },
    ],
  },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  if (!auth.isAuthed) return <Navigate to="/admin/login" replace />;

  return (
    <div className="admin">
      <header className="admin-top">
        <span className="brand-mark">Kelly&apos;s Deli</span>
        <span className="admin-tag">Staff</span>
        <button
          className="btn-ghost logout"
          onClick={() => {
            auth.clear();
            navigate("/admin/login");
          }}
        >
          Log out
        </button>
      </header>
      <nav className="admin-nav">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="admin-nav-group">
            <span className="admin-nav-group-label">{group.label}</span>
            {group.links.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? "active" : "")}>
                {n.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
