import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "@/App";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "@/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

const rot = document.getElementById("root")!;

/**
 * Den förrenderade landningssidan ligger i HTML:en så att sökmotorer och
 * AI-assistenter ser något alls utan att köra javascript. Men den som redan är
 * inloggad ska aldrig se en säljsida blinka förbi innan appen hinner starta,
 * så markupen töms direkt när det finns en session i webbläsaren.
 *
 * Nyckeln börjar med "sb-" och slutar med "-auth-token", vilket är hur
 * supabase-js namnger sin session. Hittas ingen sådan gör raden ingenting.
 */
const harSession = Object.keys(localStorage).some(
  (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
);
if (harSession && rot.childElementCount > 0) rot.replaceChildren();

createRoot(rot).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {/* Bygget kan ligga i en underkatalog (app.essensiadesign.se/piches/).
            BASE_URL är "/" för standalone och ändrar då ingenting. */}
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
