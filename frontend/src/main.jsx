import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import CustomerLayout from "./layouts/CustomerLayout.jsx";
import OpsLayout from "./layouts/OpsLayout.jsx";
import RequireRole from "./layouts/RequireRole.jsx";
import Toaster from "./components/ui/Toaster.jsx";
import SessionSync from "./components/SessionSync.jsx";
import Login from "./pages/Login.jsx";
import Storefront from "./pages/Storefront.jsx";
import ProductDetail from "./pages/ProductDetail.jsx";
import ShoppingAssistant from "./pages/ShoppingAssistant.jsx";
import PolicyAssistant from "./pages/PolicyAssistant.jsx";
import Cart from "./pages/Cart.jsx";
import Orders from "./pages/Orders.jsx";
import Account from "./pages/Account.jsx";
import Support from "./pages/Support.jsx";
import OpsDashboard from "./pages/OpsDashboard.jsx";
import OpsKnowledge from "./pages/OpsKnowledge.jsx";
import HealthPage from "./pages/HealthPage.jsx";
import NotFound from "./pages/NotFound.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <SessionSync />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/status" element={<HealthPage />} />

        <Route element={<RequireRole role="CUSTOMER" />}>
          <Route element={<CustomerLayout />}>
            <Route index element={<Storefront />} />
            <Route path="products/:sku" element={<ProductDetail />} />
            <Route path="assistant" element={<ShoppingAssistant />} />
            <Route path="policy" element={<PolicyAssistant />} />
            <Route path="cart" element={<Cart />} />
            <Route path="orders" element={<Orders />} />
            <Route path="account" element={<Account />} />
            <Route path="support" element={<Support />} />
          </Route>
        </Route>

        <Route element={<RequireRole role="MANAGER" />}>
          <Route path="ops" element={<OpsLayout />}>
            <Route index element={<OpsDashboard />} />
            <Route path="knowledge" element={<OpsKnowledge />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  </StrictMode>,
);
