import { NavLink, Outlet } from "react-router-dom";
import clsx from "clsx";
import { useAuth } from "@/auth/AuthProvider";

const tabs = [
  { to: "/", label: "Pipeline", end: true },
  { to: "/varumarken", label: "Varumärken", end: false },
  { to: "/uppgifter", label: "Uppgifter", end: false },
  { to: "/statistik", label: "Statistik", end: false },
];

export function Layout() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-sand/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3">
          <span className="text-base font-semibold">Piches</span>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  clsx(
                    "shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition",
                    isActive ? "bg-ink text-sand" : "text-ink/60 hover:bg-line/50",
                  )
                }
              >
                {tab.label}
              </NavLink>
            ))}
            <button
              onClick={signOut}
              className="ml-1 shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-ink/45 hover:bg-line/50"
            >
              Logga ut
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-6">
        <Outlet />
      </main>
    </div>
  );
}
