import { NavLink, Outlet, Navigate, useNavigate } from "react-router-dom";
import { auth } from "../../lib/admin";

const NAV = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/orders", label: "Orders" },
  { to: "/admin/prep", label: "Prep Sheet" },
  { to: "/admin/menu", label: "Menu & Pricing" },
  { to: "/admin/board-components", label: "Board Ingredients" },
  { to: "/admin/settings", label: "Site Settings" },
  { to: "/admin/sms", label: "SMS List" },
  { to: "/admin/fill-slots", label: "Fill Slots" },
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
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? "active" : "")}>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
