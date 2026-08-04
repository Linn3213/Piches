import { Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { Layout } from "@/components/Layout";
import Login from "@/pages/Login";
import Pipeline from "@/pages/Pipeline";
import Brands from "@/pages/Brands";
import BrandDetail from "@/pages/BrandDetail";
import Tasks from "@/pages/Tasks";
import Statistics from "@/pages/Statistics";

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
          <Route index element={<Pipeline />} />
          <Route path="varumarken" element={<Brands />} />
          <Route path="varumarken/:id" element={<BrandDetail />} />
          <Route path="uppgifter" element={<Tasks />} />
          <Route path="statistik" element={<Statistics />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
