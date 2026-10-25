import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import CustomerLayout from "./layouts/CustomerLayout";
import OpsLayout from "./layouts/OpsLayout";
import RequireRole from "./layouts/RequireRole";
import Toaster from "./components/ui/Toaster";
import SessionSync from "./components/SessionSync";
import Login from "./pages/Login";
import Storefront from "./pages/Storefront";
import ProductDetail from "./pages/ProductDetail";
import ShoppingAssistant from "./pages/ShoppingAssistant";
import PolicyAssistant from "./pages/PolicyAssistant";
import Cart from "./pages/Cart";
import Orders from "./pages/Orders";
import Account from "./pages/Account";
import Support from "./pages/Support";
import OpsDashboard from "./pages/OpsDashboard";
import OpsKnowledge from "./pages/OpsKnowledge";
import OpsAdmin from "./pages/OpsAdmin";
import HealthPage from "./pages/HealthPage";
import NotFound from "./pages/NotFound";
import "./index.css";

createRoot(document.getElementById("root")!).render(
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
            <Route element={<RequireRole role="ADMIN" />}>
              <Route path="admin" element={<OpsAdmin />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  </StrictMode>,
);
