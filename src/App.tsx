import { Link, Route, Routes } from "react-router-dom";
import { isStandalone } from "@/lib/brand";
import { authCallbackError } from "@/auth/magicLink";
import { Button, Empty } from "@/components/ui";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";
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
import Konto from "@/pages/Konto";
import Landing from "@/pages/Landing";

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
      <AppRutter />
    </AuthProvider>
  );
}

/**
 * Roten visar landningssidan for den som inte ar inloggad, och appen for den
 * som ar det.
 *
 * Rutten registreras VILLKORLIGT i stallet for att en komponent valjer inuti
 * sig. Ar man inloggad finns landningsrutten inte alls, och da tar index-rutten
 * over med hela appens ram omkring sig. Sa slipper vi bade en marknadssida mitt
 * i ett inloggat konto och en dubbel omdirigering vid varje sidladdning.
 *
 * Bara den fristaende appen har en landningssida. Essensia- och
 * LinnArtistry-versionerna ar palagda skin pa en kunds egen adress, och dar ar
 * appen redan sald.
 */
function AppRutter() {
  const { session, loading } = useAuth();

  // Misslyckas en inloggningslank landar Supabase pa roten med felet i
  // adressen. Da far landningssidan INTE ta over, for da svaljs felet och
  // besokaren star kvar med en marknadssida i stallet for en forklaring till
  // varfor hon inte kom in.
  const authfel = authCallbackError(window.location.href);
  const visaLanding = isStandalone && !loading && !session && !authfel;

  // Tva separata trad i stallet for en villkorlig rutt inuti ett. React Router
  // rangordnar rutter efter poang och inte efter ordning, och en index-rutt
  // vinner over path="/" aven nar den star sist. Den forsta versionen av det
  // har blev darfor en omdirigering till inloggningen, alltsa precis den sida
  // landningssidan skulle ersatta.
  if (visaLanding) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/logga-in" element={<Login />} />
        <Route
          path="*"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        />
      </Routes>
    );
  }

  return (
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
          <Route path="konto" element={<Konto />} />
          {/* En felstavad adress ska aldrig ge en tom yta utan vag tillbaka. */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
  );
}
