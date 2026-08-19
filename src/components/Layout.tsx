import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import clsx from "clsx";
import { useAuth } from "@/auth/AuthProvider";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/ui";
import { useExpiryRadar } from "@/hooks/useLicenses";
import { BRAND_LABEL } from "@/lib/brand";
import { AccessGate } from "@/components/AccessGate";

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
  { to: "/konto", label: "Konto", icon: "credit_card" },
];

/**
 * MOBILENS BOTTENRAD, fem platser och inte sex.
 *
 * Sex etiketter fick inte plats pa nagon telefon: RÄTTIGHETER krockade med
 * UPPDRAG och LÖNSAMHET med INTÄKTER pa allt under 430 pixlar, alltsa pa i
 * princip varje telefon som finns. Uppmatt i webblasare pa 320, 360, 390 och
 * 430 pixlar.
 *
 * Vardre an sa: sidomenyn ar dold under md, och den var enda vagen till
 * Varumarken, Uppgifter, Installningar och Konto. En anvandare med telefon
 * kunde alltsa inte ens oppna betalsidan, vilket ar ett direkt hal i affaren
 * for en app vars kunder jobbar fran mobilen.
 */
const MOBILNAV = NAV.filter((n) => ["/", "/uppdrag", "/rattigheter", "/pris"].includes(n.to));

const MER = [...NAV.filter((n) => !MOBILNAV.includes(n)), ...SECONDARY];

export function Layout() {
  const { signOut } = useAuth();
  const [merOppen, setMerOppen] = useState(false);
  const plats = useLocation();

  // Arket ska aldrig ligga kvar over den sida man just valde.
  useEffect(() => setMerOppen(false), [plats.pathname]);
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
            {/* Skinnen sätter färger och typsnitt via data-brand på <html>, men
                avsändarraden måste komma härifrån. Standalone har ingen, då står
                appen för sig själv. */}
            <p className="font-mono text-[10px] text-on-surface-variant">
              {BRAND_LABEL ?? "Koll på rättigheterna"}
            </p>
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
        <AccessGate>
          <Outlet />
        </AccessGate>
      </main>

      {/* Mer-arket, mobil. Har bor allt som inte far plats i bottenraden, och
          utan det gick Konto, Installningar, Varumarken och Uppgifter inte att
          na alls fran en telefon. */}
      {merOppen && (
        <div
          className="fixed inset-0 z-[60] md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Mer i menyn"
        >
          <button
            aria-label="Stäng menyn"
            onClick={() => setMerOppen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="pb-safe absolute bottom-0 left-0 max-h-[80vh] w-full overflow-y-auto rounded-t-3xl border-t border-outline-variant/30 bg-surface-container-low p-5 shadow-soft">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-outline-variant" />
            <div className="space-y-1">
              {MER.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    clsx(
                      "flex items-center gap-3 rounded-full px-4 py-3 text-label-caps uppercase transition-colors",
                      isActive
                        ? "bg-primary-container font-bold text-on-primary-container"
                        : "text-on-surface hover:bg-surface-container-highest",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon name={item.icon} filled={isActive} size={20} />
                      {item.label}
                    </>
                  )}
                </NavLink>
              ))}
              <button
                onClick={signOut}
                className="flex w-full items-center gap-3 rounded-full px-4 py-3 text-label-caps uppercase text-on-surface-variant transition-colors hover:bg-surface-container-highest"
              >
                <Icon name="logout" size={20} />
                Logga ut
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottennavigering, mobil. FYRA sidor plus Mer, inte sex.
          Sex etiketter krockade med varandra pa varje telefon under 430 pixlar. */}
      <nav className="glass pb-safe fixed bottom-0 left-0 z-50 flex w-full items-stretch rounded-t-3xl border-t border-outline-variant/30 px-1 py-2.5 md:hidden">
        {MOBILNAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              clsx(
                "relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-full px-1 py-1.5 transition-all active:scale-90",
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
                {/* Bottenraden skriver etiketterna med versal begynnelsebokstav
                    och inte i kapitaler. "RÄTTIGHETER" kraver 82 pixlar och
                    platsen ar 68, sa ordet kapades pa varje telefon. Samma ord
                    i vanlig skrift tar 58. Sidomenyn behaller kapitalerna, dar
                    finns det gott om plats. */}
                <span className="w-full truncate text-center text-[10px] font-semibold tracking-tight">
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
        <button
          onClick={() => setMerOppen(true)}
          aria-haspopup="dialog"
          aria-expanded={merOppen}
          className={clsx(
            "relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-full px-1 py-1.5 transition-all active:scale-90",
            MER.some((m) => plats.pathname.startsWith(m.to) && m.to !== "/")
              ? "bg-primary-container text-on-primary-container"
              : "text-on-surface-variant",
          )}
        >
          <Icon name="more_horiz" size={22} />
          <span className="w-full truncate text-center text-[10px] font-semibold tracking-tight">
            Mer
          </span>
        </button>
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
