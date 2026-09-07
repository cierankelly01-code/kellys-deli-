import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Outlet, useLocation } from "react-router-dom";
import { ConsentBanner } from "./components/ConsentBanner";
import { trackPageView } from "./lib/consent";
import Choice from "./pages/Choice";
import Platters from "./pages/Platters";
import Shop from "./pages/Shop";
import ShopCategory from "./pages/ShopCategory";
import PlanEvent from "./pages/PlanEvent";
import PlatterDetail from "./pages/PlatterDetail";
import Order from "./pages/Order";
import Confirm from "./pages/Confirm";
import Bread from "./pages/Bread";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import { Footer } from "./components/Footer";
import { CartDrawer } from "./components/CartDrawer";
import NotFound from "./pages/NotFound";
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const Login = lazy(() => import("./pages/admin/Login"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const Orders = lazy(() => import("./pages/admin/Orders"));
const PrepSheet = lazy(() => import("./pages/admin/PrepSheet"));
const MenuEditor = lazy(() => import("./pages/admin/MenuEditor"));
const Categories = lazy(() => import("./pages/admin/Categories"));
const Bundles = lazy(() => import("./pages/admin/Bundles"));
const Enquiries = lazy(() => import("./pages/admin/Enquiries"));
const AddOnsAdmin = lazy(() => import("./pages/admin/AddOns"));
const Recommender = lazy(() => import("./pages/admin/Recommender"));
const SiteSettings = lazy(() => import("./pages/admin/SiteSettings"));
const SmsList = lazy(() => import("./pages/admin/SmsList"));
const FillSlots = lazy(() => import("./pages/admin/FillSlots"));
const BreadOrders = lazy(() => import("./pages/admin/BreadOrders"));
const BreadBakeSheet = lazy(() => import("./pages/admin/BreadBakeSheet"));
const BreadSettings = lazy(() => import("./pages/admin/BreadSettings"));

/** Wraps customer-facing pages so every one ends with the site footer + legal links. */
function CustomerLayout() {
  const location = useLocation();

  // Fire a page view on every route change. Safe no-op until (and unless) the visitor has
  // consented and a tracker is loaded — see lib/consent.ts. Admin pages sit outside this
  // layout, so staff activity is never tracked.
  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);

  return (
    <>
      {/* Lives here, not in Header: the Header renders inside <main>, so a skip link
          in there targets its own container and does nothing. */}
      <a className="skip-link" href="#main">Skip to content</a>
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <CartDrawer />
      <Footer />
      <ConsentBanner />
    </>
  );
}

export default function App() {
  return (
    <Suspense fallback={<p className="app" role="status">Loading…</p>}>
    <Routes>
      {/* Customer pages — share a footer with the legal links */}
      <Route element={<CustomerLayout />}>
        <Route path="/" element={<Choice />} />
        <Route path="/platters" element={<Platters />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/shop/:slug" element={<ShopCategory />} />
        <Route path="/plan" element={<PlanEvent />} />
        <Route path="/platter/:id" element={<PlatterDetail />} />
        <Route path="/order" element={<Order />} />
        <Route path="/confirm/:ref" element={<Confirm />} />
        <Route path="/bread" element={<Bread />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Admin */}
      <Route path="/admin/login" element={<Login />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="orders" element={<Orders />} />
        <Route path="prep" element={<PrepSheet />} />
        <Route path="menu" element={<MenuEditor />} />
        <Route path="categories" element={<Categories />} />
        <Route path="bundles" element={<Bundles />} />
        <Route path="enquiries" element={<Enquiries />} />
        <Route path="add-ons" element={<AddOnsAdmin />} />
        <Route path="recommender" element={<Recommender />} />
        <Route path="settings" element={<SiteSettings />} />
        <Route path="sms" element={<SmsList />} />
        <Route path="fill-slots" element={<FillSlots />} />
        <Route path="bread" element={<BreadOrders />} />
        <Route path="bread/bake-sheet" element={<BreadBakeSheet />} />
        <Route path="bread/settings" element={<BreadSettings />} />
      </Route>

    </Routes>
    </Suspense>
  );
}
