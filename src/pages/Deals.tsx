import { useState } from "react";
import { Link } from "react-router-dom";
import { useBrands, useCreateBrand } from "@/hooks/useBrands";
import { useCreatePitch, usePitches } from "@/hooks/usePitches";
import { useLicenses } from "@/hooks/useLicenses";
import { useEconomy } from "@/hooks/useEconomy";
import { formatDateFull, formatMoney, plural } from "@/lib/format";
import { Badge, Button, Card, Empty, Icon, Loading, Modal, PageHeader } from "@/components/ui";
import { PitchForm } from "@/components/PitchForm";
import { BrandForm } from "@/components/BrandForm";
import { BriefImport } from "@/components/BriefImport";
import { daysBetween, parseDate } from "@/lib/rights";
import { PITCH_STATUS_LABEL, type Pitch, type PitchStatus } from "@/types/db";

/**
 * Kanbanen ligger på uppdrag, inte på varumärken. Ett varumärke du jobbat med
 * förut kan ha en förnyelse på gång samtidigt som ett helt nytt uppdrag är i
 * produktion, och lägger man brädet på varumärket går bara ett av dem att se.
 *
 * Betalt och förlorat lämnar brädet som förval. Brädet ska handla om arbete
 * som återstår, inte om ett arkiv som växer för alltid.
 */
const WORKING: PitchStatus[] = [
  "utkast",
  "skickad",
  "svarat",
  "offert",
  "vunnen",
  "produktion",
  "levererat",
  "fakturerat",
];

const CLOSED: PitchStatus[] = ["betalt", "forlorad", "ingen_respons"];

export default function Deals() {
  const { data: pitches, isLoading, error } = usePitches();
  const { data: brands } = useBrands();
  const { data: licenses } = useLicenses();
  const economy = useEconomy();
  const createPitch = useCreatePitch();
  const createBrand = useCreateBrand();
  const [showClosed, setShowClosed] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);

  if (isLoading) return <Loading />;
  if (error) return <p className="text-body-md text-error">Kunde inte hämta uppdragen.</p>;

  const all = pitches ?? [];
  const columns = showClosed ? [...WORKING, ...CLOSED] : WORKING;
  const onBoard = all.filter((p) => columns.includes(p.status));
  const closedCount = all.filter((p) => CLOSED.includes(p.status)).length;

  const brandName = (id: string) => brands?.find((b) => b.id === id)?.name ?? "Okänt varumärke";
  const licenseCount = (pitchId: string) =>
    (licenses ?? []).filter((l) => l.pitch_id === pitchId).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Uppdrag"
        subtitle="Hela vägen från förfrågan till betald faktura, och vidare till förnyelsen."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setBriefOpen(true)}>
              <Icon name="content_paste" size={18} />
              Klistra in förfrågan
            </Button>
            <Button onClick={() => setNewOpen(true)} disabled={!brands?.length}>
              Nytt uppdrag
            </Button>
          </div>
        }
      />

      {all.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MoneyTile
            label="Vunnet, ej fakturerat"
            value={economy.money.contracted}
            icon="handshake"
          />
          <MoneyTile label="Fakturerat, väntar" value={economy.money.outstanding} icon="schedule" />
          <MoneyTile
            label="Förfallet"
            value={economy.money.overdue}
            icon="warning"
            danger={economy.money.overdue > 0}
          />
          <MoneyTile label="Inbetalt" value={economy.money.paid} icon="account_balance" primary />
        </div>
      )}

      {all.length === 0 ? (
        // Utan varumarke ar knappen ovanfor utgraad, och da maste tomlaget
        // sjalvt leda vidare. Annars star hon i en atervandsgrand dar enda
        // vagen ut ligger i sekundarmenyn.
        <Empty
          icon="handshake"
          title="Inga uppdrag än"
          hint={
            brands?.length
              ? "Skapa ett uppdrag så följer appen det hela vägen till betalt, och håller koll på rättigheterna efteråt."
              : "Uppdrag hänger på ett varumärke, så börja med att lägga till en kund."
          }
          action={
            brands?.length ? (
              <Button onClick={() => setNewOpen(true)}>Skapa uppdrag</Button>
            ) : (
              <Button onClick={() => setBrandOpen(true)}>Lägg till varumärke</Button>
            )
          }
        />
      ) : (
        <>
          <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-4 no-scrollbar md:mx-0 md:px-0">
            {columns.map((status) => {
              const inColumn = onBoard.filter((p) => p.status === status);
              const columnValue = inColumn.reduce((sum, p) => sum + (p.value_sek ?? 0), 0);
              return (
                <section
                  key={status}
                  className="flex min-h-[280px] w-[286px] shrink-0 flex-col rounded-2xl border border-outline-variant/30 bg-surface-container p-4"
                >
                  <div className="mb-4 border-b border-outline-variant/30 pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-label-caps uppercase text-on-surface-variant">
                        {PITCH_STATUS_LABEL[status]}
                      </span>
                      <span className="rounded-full bg-surface-container-highest px-2.5 py-1 font-mono text-xs">
                        {inColumn.length}
                      </span>
                    </div>
                    {columnValue > 0 && (
                      <p className="mt-1.5 font-mono text-xs text-on-surface-variant">
                        {formatMoney(columnValue)}
                      </p>
                    )}
                  </div>

                  {inColumn.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-outline-variant/30">
                      <span className="text-body-md text-on-surface-variant/60">Tom</span>
                    </div>
                  ) : (
                    <ul className="flex-1 space-y-3">
                      {inColumn.map((deal) => (
                        <li key={deal.id}>
                          <DealCard
                            deal={deal}
                            brand={brandName(deal.brand_id)}
                            licenses={licenseCount(deal.id)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>

          {closedCount > 0 && (
            <button
              onClick={() => setShowClosed((v) => !v)}
              className="flex items-center gap-2 text-body-md text-on-surface-variant transition-colors hover:text-on-surface"
            >
              <Icon name={showClosed ? "visibility_off" : "visibility"} size={18} />
              {showClosed
                ? "Dölj avslutade uppdrag"
                : `Visa ${plural(closedCount, "avslutat uppdrag", "avslutade uppdrag")}`}
            </button>
          )}
        </>
      )}

      <Modal
        open={briefOpen}
        title="Läs av en förfrågan"
        wide
        onClose={() => setBriefOpen(false)}
      >
        <BriefImport onClose={() => setBriefOpen(false)} />
      </Modal>

      <Modal open={brandOpen} title="Nytt varumärke" onClose={() => setBrandOpen(false)}>
        <BrandForm
          submitLabel="Lägg till"
          busy={createBrand.isPending}
          onSubmit={(draft) =>
            createBrand.mutate(draft, {
              onSuccess: () => {
                setBrandOpen(false);
                setNewOpen(true);
              },
            })
          }
        />
      </Modal>

      <Modal open={newOpen} title="Nytt uppdrag" onClose={() => setNewOpen(false)}>
        <PitchForm
          brands={brands ?? []}
          busy={createPitch.isPending}
          onSubmit={(draft) => {
            if (!draft.brand_id) return;
            createPitch.mutate(
              { ...draft, brand_id: draft.brand_id },
              { onSuccess: () => setNewOpen(false) },
            );
          }}
        />
      </Modal>
    </div>
  );
}

function MoneyTile({
  label,
  value,
  icon,
  danger,
  primary,
}: {
  label: string;
  value: number;
  icon: string;
  danger?: boolean;
  primary?: boolean;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2 text-on-surface-variant">
        <Icon name={icon} size={18} />
        <span className="text-label-caps uppercase">{label}</span>
      </div>
      <p
        className={
          danger
            ? "mt-3 font-mono text-2xl font-medium text-error"
            : primary
              ? "mt-3 font-mono text-2xl font-medium text-primary"
              : "mt-3 font-mono text-2xl font-medium text-on-surface"
        }
      >
        {value > 0 ? formatMoney(value) : "–"}
      </p>
    </Card>
  );
}

function DealCard({ deal, brand, licenses }: { deal: Pitch; brand: string; licenses: number }) {
  // Samma tolkning som ekonomin anvander. Rakt `new Date("2026-08-05")` blir
  // UTC-midnatt, alltsa kl 02 svensk sommartid, och da markerades en faktura
  // som forfaller idag som forsenad har medan Intakter sa noll.
  const daysLeft =
    deal.due_on !== null ? daysBetween(new Date(), parseDate(deal.due_on)) : null;
  const overdue =
    deal.invoiced_on !== null && deal.paid_on === null && daysLeft !== null && daysLeft < 0;

  return (
    <Link to={`/uppdrag/${deal.id}`} className="block">
      <Card
        className={
          overdue
            ? "border-l-2 border-l-error p-5 transition-all hover:-translate-y-0.5 hover:shadow-soft"
            : "p-5 transition-all hover:-translate-y-0.5 hover:shadow-soft"
        }
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-label-caps uppercase text-primary">{brand}</p>
          {deal.renewed_from_license_id && (
            <Icon name="autorenew" size={16} className="shrink-0 text-primary" />
          )}
        </div>

        {deal.subject && (
          <p className="mt-1.5 line-clamp-2 text-body-md text-on-surface">{deal.subject}</p>
        )}

        {deal.value_sek !== null && (
          <p className="mt-2 font-mono text-mono-data text-on-surface">
            {formatMoney(deal.value_sek)}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {licenses > 0 && (
            <Badge tone="info">
              <Icon name="gavel" size={12} /> {licenses}
            </Badge>
          )}
          {overdue && <Badge tone="danger">Förfallen {formatDateFull(deal.due_on)}</Badge>}
        </div>
      </Card>
    </Link>
  );
}
