import { NavLink, Outlet } from "react-router-dom";
import clsx from "clsx";
import { useAuth } from "@/auth/AuthProvider";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/ui";
import { useExpiryRadar } from "@/hooks/useLicenses";

const NAV = [
  { to: "/", label: "Idag", icon: "dashboard", end: true },
  { to: "/uppdrag", label: "Uppdrag", icon: "handshake", end: false },
  { to: "/rattigheter", label: "Rättigheter", icon: "gavel", end: false },
  { to: "/pris", label: "Pris", icon: "calculate", end: false },
  { to: "/intakter", label: "Intäkter", icon: "payments", end: false },
  { to: "/lonsamhet", label: "Lönsamhet", icon: "trending_up", end: false },
];

const SECONDARY = [
  { to: "/varumarken", label: "Varumärken", icon: "storefront" },
  { to: "/uppgifter", label: "Uppgifter", icon: "checklist" },
  { to: "/installningar", label: "Inställningar", icon: "settings" },
];

export function Layout() {
  const { signOut } = useAuth();
  // Antalet licenser som snart går ut styr notisbrickan — det är den
  // siffran som faktiskt betyder pengar på väg att rinna ut.
  const { data: radar } = useExpiryRadar();
  const expiring = radar?.expiring.length ?? 0;

  return (
    <div className="min-h-screen md:pl-[248px]">
      {/* Sidomeny, desktop */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[248px] flex-col border-r border-outline-variant/30 bg-surface-container-low md:flex">
        <div className="flex items-center gap-3 px-6 py-6">
          <Logo size={36} />
          <div>
            <p className="text-headline-sm tracking-tight text-primary">Piches</p>
            <p className="font-mono text-[10px] text-on-surface-variant">Koll på rättigheterna</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4">
          {NAV.map((item) => (
            <SideLink key={item.to} {...item} badge={item.to === "/rattigheter" ? expiring : 0} />
          ))}
          <div className="!mt-6 mb-2 px-3 text-label-caps uppercase text-on-surface-variant/60">
            Övrigt
          </div>
          {SECONDARY.map((item) => (
            <SideLink key={item.to} {...item} end={false} />
          ))}
        </nav>

        <div className="border-t border-outline-variant/30 p-4">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-full px-3 py-2.5 text-label-caps uppercase text-on-surface-variant transition-colors hover:bg-surface-container-highest"
          >
            <Icon name="logout" size={20} />
            Logga ut
          </button>
        </div>
      </aside>

      {/* Toppfält, mobil */}
      <header className="glass sticky top-0 z-40 flex h-16 items-center justify-between border-b border-outline-variant/30 px-5 md:hidden">
        <div className="flex items-center gap-2.5">
          <Logo size={30} />
          <span className="text-headline-sm tracking-tight text-primary">Piches</span>
        </div>
        <button
          onClick={signOut}
          aria-label="Logga ut"
          className="grid h-10 w-10 place-items-center rounded-full text-on-surface-variant"
        >
          <Icon name="logout" />
        </button>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-28 pt-6 md:px-10 md:pb-14 md:pt-10">
        <Outlet />
      </main>

      {/* Bottennavigering, mobil */}
      <nav className="glass pb-safe fixed bottom-0 left-0 z-50 flex w-full items-center justify-around rounded-t-3xl border-t border-outline-variant/30 px-2 py-2.5 md:hidden">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              clsx(
                "relative flex min-w-[62px] flex-col items-center gap-1 rounded-full px-3 py-1.5 transition-all active:scale-90",
                isActive
                  ? "bg-primary-container text-on-primary-container"
                  : "text-on-surface-variant",
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className="relative">
                  <Icon name={item.icon} filled={isActive} size={22} />
                  {item.to === "/rattigheter" && expiring > 0 && (
                    <span className="absolute -right-1.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-error px-1 font-mono text-[9px] text-on-error">
                      {expiring}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wide">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function SideLink({
  to,
  label,
  icon,
  end,
  badge = 0,
}: {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
  badge?: number;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        clsx(
          "flex items-center gap-3 rounded-full px-3 py-2.5 text-label-caps uppercase transition-colors",
          isActive
            ? "bg-primary-container font-bold text-on-primary-container"
            : "text-on-surface-variant hover:bg-surface-container-highest",
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon name={icon} filled={isActive} size={20} />
          <span className="flex-1">{label}</span>
          {badge > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-error px-1.5 font-mono text-[10px] text-on-error">
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}
