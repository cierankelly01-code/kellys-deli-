import { Routes, Route } from "react-router-dom";
import Choice from "./pages/Choice";
import Menu from "./pages/Menu";
import Platters from "./pages/Platters";
import ConfigureBoard from "./pages/ConfigureBoard";
import PlatterDetail from "./pages/PlatterDetail";
import Tastings from "./pages/Tastings";
import Order from "./pages/Order";
import Book from "./pages/Book";
import Confirm from "./pages/Confirm";
import AdminLayout from "./pages/admin/AdminLayout";
import Login from "./pages/admin/Login";
import Dashboard from "./pages/admin/Dashboard";
import Orders from "./pages/admin/Orders";
import PrepSheet from "./pages/admin/PrepSheet";
import MenuEditor from "./pages/admin/MenuEditor";
import BoardComponents from "./pages/admin/BoardComponents";
import SiteSettings from "./pages/admin/SiteSettings";
import SmsList from "./pages/admin/SmsList";
import FillSlots from "./pages/admin/FillSlots";

export default function App() {
  return (
    <Routes>
      {/* Customer */}
      <Route path="/" element={<Choice />} />
      <Route path="/menu/:category" element={<Menu />} />
      <Route path="/platters" element={<Platters />} />
      <Route path="/configure" element={<ConfigureBoard />} />
      <Route path="/platter/:id" element={<PlatterDetail />} />
      <Route path="/tastings" element={<Tastings />} />
      <Route path="/order" element={<Order />} />
      <Route path="/book" element={<Book />} />
      <Route path="/confirm/:ref" element={<Confirm />} />

      {/* Admin */}
      <Route path="/admin/login" element={<Login />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="orders" element={<Orders />} />
        <Route path="prep" element={<PrepSheet />} />
        <Route path="menu" element={<MenuEditor />} />
        <Route path="board-components" element={<BoardComponents />} />
        <Route path="settings" element={<SiteSettings />} />
        <Route path="sms" element={<SmsList />} />
        <Route path="fill-slots" element={<FillSlots />} />
      </Route>

      <Route path="*" element={<Choice />} />
    </Routes>
  );
}
