import { Routes, Route, Outlet } from "react-router-dom";
import Choice from "./pages/Choice";
import Platters from "./pages/Platters";
import Shop from "./pages/Shop";
import ShopCategory from "./pages/ShopCategory";
import PlanEvent from "./pages/PlanEvent";
import PlatterDetail from "./pages/PlatterDetail";
import Order from "./pages/Order";
import Confirm from "./pages/Confirm";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import { Footer } from "./components/Footer";
import { CartDrawer } from "./components/CartDrawer";
import NotFound from "./pages/NotFound";
import AdminLayout from "./pages/admin/AdminLayout";
import Login from "./pages/admin/Login";
import Dashboard from "./pages/admin/Dashboard";
import Orders from "./pages/admin/Orders";
import PrepSheet from "./pages/admin/PrepSheet";
import MenuEditor from "./pages/admin/MenuEditor";
import Categories from "./pages/admin/Categories";
import Bundles from "./pages/admin/Bundles";
import Enquiries from "./pages/admin/Enquiries";
import AddOnsAdmin from "./pages/admin/AddOns";
import Recommender from "./pages/admin/Recommender";
import SiteSettings from "./pages/admin/SiteSettings";
import SmsList from "./pages/admin/SmsList";
import FillSlots from "./pages/admin/FillSlots";

/** Wraps customer-facing pages so every one ends with the site footer + legal links. */
function CustomerLayout() {
  return (
    <>
      <main id="main">
        <Outlet />
      </main>
      <CartDrawer />
      <Footer />
    </>
  );
}

export default function App() {
  return (
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
      </Route>

    </Routes>
  );
}
