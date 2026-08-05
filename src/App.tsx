import { Link, Route, Routes } from "react-router-dom";
import { Button, Empty } from "@/components/ui";
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
import Profit from "@/pages/Profit";
import Brands from "@/pages/Brands";
import BrandDetail from "@/pages/BrandDetail";
import Tasks from "@/pages/Tasks";
import Settings from "@/pages/Settings";

function NotFound() {
  return (
    <Empty
      icon="explore_off"
      title="Sidan finns inte"
      hint="Länken kan vara gammal, eller så blev det ett stavfel på vägen."
      action={
        <Link to="/">
          <Button>Till Idag</Button>
        </Link>
      }
    />
  );
}

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
          <Route path="lonsamhet" element={<Profit />} />
          <Route path="varumarken" element={<Brands />} />
          <Route path="varumarken/:id" element={<BrandDetail />} />
          <Route path="uppgifter" element={<Tasks />} />
          <Route path="installningar" element={<Settings />} />
          {/* En felstavad adress ska aldrig ge en tom yta utan vag tillbaka. */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
