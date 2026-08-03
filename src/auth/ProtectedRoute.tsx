import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/auth/AuthProvider";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-ink/50">
        Laddar...
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/logga-in" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
