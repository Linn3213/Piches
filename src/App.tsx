import { Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { Layout } from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Deals from "@/pages/Deals";
import DealDetail from "@/pages/DealDetail";
import InvoicePage from "@/pages/InvoicePage";
import Rights from "@/pages/Rights";
import Pricing from "@/pages/Pricing";
import Revenue from "@/pages/Revenue";
import Brands from "@/pages/Brands";
import BrandDetail from "@/pages/BrandDetail";
import Tasks from "@/pages/Tasks";
import Settings from "@/pages/Settings";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/logga-in" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="uppdrag" element={<Deals />} />
          <Route path="uppdrag/:id" element={<DealDetail />} />
          <Route path="uppdrag/:id/faktura" element={<InvoicePage />} />
          <Route path="rattigheter" element={<Rights />} />
          <Route path="pris" element={<Pricing />} />
          <Route path="intakter" element={<Revenue />} />
          <Route path="varumarken" element={<Brands />} />
          <Route path="varumarken/:id" element={<BrandDetail />} />
          <Route path="uppgifter" element={<Tasks />} />
          <Route path="installningar" element={<Settings />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
