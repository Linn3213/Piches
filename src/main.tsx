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

createRoot(document.getElementById("root")!).render(
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
