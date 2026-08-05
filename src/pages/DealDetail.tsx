import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useBrand } from "@/hooks/useBrands";
import { useDeletePitch, usePitch, useUpdatePitch } from "@/hooks/usePitches";
import {
  useCreateDeliverable,
  useDeleteDeliverable,
  useDeliverables,
  useUpdateDeliverable,
} from "@/hooks/useDeliverables";
import { useCreateLicense, useDeleteLicense, useLicenses } from "@/hooks/useLicenses";
import { useSettings } from "@/hooks/useSettings";
import { DeliverableForm } from "@/components/DeliverableForm";
import { LicenseForm } from "@/components/LicenseForm";
import { Badge, Button, Card, Empty, Field, Icon, Input, Loading, Modal } from "@/components/ui";
import { days as daysLabel, formatDate, formatDateFull, formatMoney } from "@/lib/format";
import { dealHourlyRate, dealProfit } from "@/lib/economy";
import { daysUntilExpiry, licenseState } from "@/lib/rights";
import {
  CHANNEL_LABEL,
  DEAL_PIPELINE,
  FORMAT_LABEL,
  PITCH_STATUS_LABEL,
  STATUS_HINT,
  TERRITORY_LABEL,
  type Deliverable,
  type License,
  type PitchStatus,
} from "@/types/db";

/** Nästa naturliga steg, formulerat som det du faktiskt gjorde. */
const NEXT_STEP: Partial<Record<PitchStatus, { to: PitchStatus; label: string }>> = {
  utkast: { to: "skickad", label: "Jag har skickat den" },
  skickad: { to: "svarat", label: "De har svarat" },
  svarat: { to: "offert", label: "Offert skickad" },
  offert: { to: "vunnen", label: "Vi fick jobbet" },
  vunnen: { to: "produktion", label: "Börja producera" },
  produktion: { to: "levererat", label: "Levererat till kund" },
  levererat: { to: "fakturerat", label: "Fakturan är skickad" },
  fakturerat: { to: "betalt", label: "Pengarna har kommit" },
};

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: deal, isLoading, error } = usePitch(id);
  const { data: brand } = useBrand(deal?.brand_id);
  const { data: deliverables } = useDeliverables(id);
  const { data: allLicenses } = useLicenses();
  const { data: settings } = useSettings();

  const updateDeal = useUpdatePitch();
  const deleteDeal = useDeletePitch();
  const createDeliverable = useCreateDeliverable();
  const updateDeliverable = useUpdateDeliverable();
  const deleteDeliverable = useDeleteDeliverable();
  const createLicense = useCreateLicense();
  const deleteLicense = useDeleteLicense();

  const [deliverableOpen, setDeliverableOpen] = useState(false);
  const [editing, setEditing] = useState<Deliverable | null>(null);
  const [licenseOpen, setLicenseOpen] = useState(false);

  if (!id) return <Navigate to="/uppdrag" replace />;
  if (isLoading) return <Loading />;
  if (error || !deal) return <p className="text-body-md text-error">Hittade inte uppdraget.</p>;

  const licenses = (allLicenses ?? []).filter((l) => l.pitch_id === deal.id);
  const items = deliverables ?? [];
  const next = NEXT_STEP[deal.status];
  const profit = dealProfit(deal);
  const hourly = dealHourlyRate(deal);
  const stepIndex = DEAL_PIPELINE.indexOf(deal.status);
  const lost = deal.status === "forlorad" || deal.status === "ingen_respons";

  // Levererat utan registrerade rattigheter ar appens dyraste blinda flack:
  // da tickar ingen klocka, och forlangningen kommer aldrig upp pa radarn.
  const missingLicense =
    !lost && licenses.length === 0 && ["levererat", "fakturerat", "betalt"].includes(deal.status);

  return (
    <div className="space-y-8">
      <div>
        <Link
          to="/uppdrag"
          className="inline-flex items-center gap-1 text-body-md text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <Icon name="arrow_back" size={16} />
          Uppdrag
        </Link>
      </div>

      <Card>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0">
            {brand && (
              <Link
                to={`/varumarken/${brand.id}`}
                className="text-label-caps uppercase text-primary hover:underline"
              >
                {brand.name}
              </Link>
            )}
            <h1 className="mt-1 text-headline-lg text-on-background">
              {deal.subject || "Uppdrag utan rubrik"}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone={lost ? "neutral" : deal.status === "betalt" ? "primary" : "info"}>
                {PITCH_STATUS_LABEL[deal.status]}
              </Badge>
              {deal.value_sek !== null && (
                <span className="font-mono text-mono-data text-on-surface">
                  {formatMoney(deal.value_sek)}
                </span>
              )}
              {deal.renewed_from_license_id && (
                <Badge tone="info">
                  <Icon name="autorenew" size={13} /> Förnyelse
                </Badge>
              )}
            </div>
            {STATUS_HINT[deal.status] && (
              <p className="mt-2 text-body-md text-on-surface-variant">
                {STATUS_HINT[deal.status]}
              </p>
            )}
          </div>

          {next && (
            <Button
              className="shrink-0"
              disabled={updateDeal.isPending}
              onClick={() => updateDeal.mutate({ id: deal.id, patch: { status: next.to } })}
            >
              {next.label}
            </Button>
          )}
        </div>

        {!lost && stepIndex >= 0 && (
          <ol className="mt-6 flex gap-1" aria-label="Uppdragets gång">
            {DEAL_PIPELINE.map((s, i) => (
              <li
                key={s}
                className="flex-1"
                title={PITCH_STATUS_LABEL[s]}
                aria-current={i === stepIndex ? "step" : undefined}
              >
                <div
                  className={
                    i <= stepIndex ? "h-1.5 rounded-full bg-primary" : "h-1.5 rounded-full bg-surface-container-highest"
                  }
                />
              </li>
            ))}
          </ol>
        )}
      </Card>

      {missingLicense && (
        <Card className="border-l-2 border-l-error">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-error-container text-on-error-container">
              <Icon name="gavel" />
            </div>
            <div>
              <p className="text-headline-sm text-on-surface">Rättigheterna är inte registrerade</p>
              <p className="mt-1 text-body-md text-on-surface-variant">
                Materialet är levererat men ingen licens är upplagd, alltså tickar ingen klocka och
                förnyelsen kommer aldrig upp på radarn. Det är precis den intäkten som brukar
                försvinna utan att någon märker det.
              </p>
              <Button className="mt-4" onClick={() => setLicenseOpen(true)}>
                Registrera rättigheterna
              </Button>
            </div>
          </div>
        </Card>
      )}

      {deal.observation && (
        <Card>
          <p className="text-label-caps uppercase text-on-surface-variant">Observationen</p>
          <p className="mt-2 whitespace-pre-wrap text-body-md text-on-surface">
            {deal.observation}
          </p>
        </Card>
      )}

      {/* Leverabler ------------------------------------------------------ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-headline-sm text-on-surface">Det du levererar</h2>
            <p className="text-body-md text-on-surface-variant">
              Varje sak för sig, så att rättigheterna kan hänga på rätt material.
            </p>
          </div>
          <Button variant="ghost" onClick={() => setDeliverableOpen(true)}>
            Lägg till
          </Button>
        </div>

        {items.length === 0 ? (
          <Empty
            icon="movie"
            title="Inget upplagt än"
            hint="Lägg upp filmerna och bilderna uppdraget innehåller, så vet du vad som är klart och vad som väntar."
          />
        ) : (
          <ul className="space-y-3">
            {items.map((d) => (
              <li key={d.id}>
                <DeliverableRow
                  deliverable={d}
                  busy={updateDeliverable.isPending}
                  onEdit={() => setEditing(d)}
                  onToggleDelivered={() =>
                    updateDeliverable.mutate({
                      id: d.id,
                      patch: { delivered_at: d.delivered_at ? null : new Date().toISOString() },
                    })
                  }
                  onToggleApproved={() =>
                    updateDeliverable.mutate({
                      id: d.id,
                      patch: { approved_at: d.approved_at ? null : new Date().toISOString() },
                    })
                  }
                  onDelete={() => {
                    if (confirm(`Ta bort ${d.title}? Licenser som hänger på den försvinner också.`)) {
                      deleteDeliverable.mutate(d.id);
                    }
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Rättigheter ----------------------------------------------------- */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-headline-sm text-on-surface">Rättigheterna</h2>
            <p className="text-body-md text-on-surface-variant">
              Det här startar klockan, och det är klockan som ger dig förnyelsen.
            </p>
          </div>
          <Button variant="ghost" onClick={() => setLicenseOpen(true)}>
            Registrera
          </Button>
        </div>

        {licenses.length === 0 ? (
          <Empty
            icon="gavel"
            title="Inga rättigheter registrerade"
            hint="Utan en licens vet appen inte när kunden måste sluta använda materialet, och då kan den heller inte påminna dig om att sälja förlängningen."
          />
        ) : (
          <ul className="space-y-3">
            {licenses.map((l) => (
              <li key={l.id}>
                <LicenseRow
                  license={l}
                  deliverableTitle={
                    l.deliverable_id
                      ? (items.find((d) => d.id === l.deliverable_id)?.title ?? "Leverabel")
                      : "Hela uppdraget"
                  }
                  leadDays={settings?.renewal_lead_days ?? 30}
                  onDelete={() => {
                    if (confirm("Ta bort licensen? Bevakningen av den upphör.")) {
                      deleteLicense.mutate(l.id);
                    }
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Pengarna -------------------------------------------------------- */}
      <section className="space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-headline-sm text-on-surface">Pengarna</h2>
            <p className="max-w-prose text-body-md text-on-surface-variant">
              Alla belopp är exklusive moms. Fakturaunderlaget skapas här, men den bokförs och
              sparas i ditt bokföringsprogram.
            </p>
          </div>
          <Link to={`/uppdrag/${deal.id}/faktura`} className="shrink-0">
            <Button variant="ghost">
              <Icon name="receipt_long" size={18} />
              {deal.invoice_number ? `Faktura ${deal.invoice_number}` : "Skapa faktura"}
            </Button>
          </Link>
        </div>

        <Card className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ordervärde">
              <Input
                type="number"
                min={0}
                step={100}
                value={deal.value_sek ?? ""}
                onChange={(e) =>
                  updateDeal.mutate({
                    id: deal.id,
                    patch: { value_sek: e.target.value === "" ? null : Number(e.target.value) },
                  })
                }
              />
            </Field>
            <Field label="Fakturanummer">
              <Input
                value={deal.invoice_number ?? ""}
                onChange={(e) =>
                  updateDeal.mutate({
                    id: deal.id,
                    patch: { invoice_number: e.target.value || null },
                  })
                }
                placeholder="2026-041"
              />
            </Field>
            <Field label="Fakturerad">
              <Input
                type="date"
                value={deal.invoiced_on ?? ""}
                onChange={(e) =>
                  updateDeal.mutate({
                    id: deal.id,
                    patch: { invoiced_on: e.target.value || null },
                  })
                }
              />
            </Field>
            <Field label="Förfaller">
              <Input
                type="date"
                value={deal.due_on ?? ""}
                onChange={(e) =>
                  updateDeal.mutate({ id: deal.id, patch: { due_on: e.target.value || null } })
                }
              />
            </Field>
            <Field label="Betald">
              <Input
                type="date"
                value={deal.paid_on ?? ""}
                onChange={(e) =>
                  updateDeal.mutate({ id: deal.id, patch: { paid_on: e.target.value || null } })
                }
              />
            </Field>
            <Field label="Inköpta kostnader" hint="Redigering, resa, rekvisita, allt du betalade.">
              <Input
                type="number"
                min={0}
                step={100}
                value={deal.production_cost_sek ?? ""}
                onChange={(e) =>
                  updateDeal.mutate({
                    id: deal.id,
                    patch: {
                      production_cost_sek: e.target.value === "" ? null : Number(e.target.value),
                    },
                  })
                }
              />
            </Field>
            <Field label="Nedlagda timmar" hint="Inspelning, klippning, mejl och möten.">
              <Input
                type="number"
                min={0}
                step={0.5}
                value={deal.hours_spent ?? ""}
                onChange={(e) =>
                  updateDeal.mutate({
                    id: deal.id,
                    patch: { hours_spent: e.target.value === "" ? null : Number(e.target.value) },
                  })
                }
              />
            </Field>
            <Field label="Revisionsrundor" hint="Hur många gånger de bad om ändringar.">
              <Input
                type="number"
                min={0}
                max={99}
                value={deal.revision_rounds}
                onChange={(e) =>
                  updateDeal.mutate({
                    id: deal.id,
                    patch: { revision_rounds: Math.max(0, Number(e.target.value) || 0) },
                  })
                }
              />
            </Field>
          </div>

          {(profit !== null || hourly !== null) && (
            <div className="flex flex-wrap gap-6 border-t border-outline-variant/30 pt-4">
              {profit !== null && (
                <div>
                  <p className="text-label-caps uppercase text-on-surface-variant">
                    Kvar efter kostnader
                  </p>
                  <p className="mt-1 font-mono text-2xl text-on-surface">{formatMoney(profit)}</p>
                </div>
              )}
              {hourly !== null && (
                <div>
                  <p className="text-label-caps uppercase text-on-surface-variant">Per timme</p>
                  <p className="mt-1 font-mono text-2xl text-on-surface">
                    {formatMoney(Math.round(hourly))}
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>
      </section>

      <div className="pt-4">
        <button
          onClick={() => {
            if (confirm("Ta bort uppdraget? Leverabler och licenser försvinner med det.")) {
              deleteDeal.mutate(deal.id, { onSuccess: () => navigate("/uppdrag") });
            }
          }}
          className="text-xs text-error hover:underline"
        >
          Ta bort uppdraget
        </button>
      </div>

      <Modal
        open={deliverableOpen || editing !== null}
        title={editing ? "Ändra leverabel" : "Ny leverabel"}
        onClose={() => {
          setDeliverableOpen(false);
          setEditing(null);
        }}
      >
        <DeliverableForm
          key={editing?.id ?? "ny"}
          initial={editing ?? undefined}
          busy={createDeliverable.isPending || updateDeliverable.isPending}
          submitLabel={editing ? "Spara" : "Lägg till"}
          onSubmit={(draft) => {
            if (editing) {
              updateDeliverable.mutate(
                { id: editing.id, patch: draft },
                { onSuccess: () => setEditing(null) },
              );
            } else {
              createDeliverable.mutate(
                { ...draft, pitch_id: deal.id, brand_id: deal.brand_id },
                { onSuccess: () => setDeliverableOpen(false) },
              );
            }
          }}
        />
      </Modal>

      <Modal
        open={licenseOpen}
        title="Registrera rättigheterna"
        wide
        onClose={() => setLicenseOpen(false)}
      >
        <LicenseForm
          pitchId={deal.id}
          brandId={deal.brand_id}
          deliverables={items}
          busy={createLicense.isPending}
          onSubmit={(draft) =>
            createLicense.mutate(draft, { onSuccess: () => setLicenseOpen(false) })
          }
        />
      </Modal>
    </div>
  );
}

function DeliverableRow({
  deliverable: d,
  busy,
  onEdit,
  onToggleDelivered,
  onToggleApproved,
  onDelete,
}: {
  deliverable: Deliverable;
  busy: boolean;
  onEdit: () => void;
  onToggleDelivered: () => void;
  onToggleApproved: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-headline-sm text-on-surface">{d.title}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge>{FORMAT_LABEL[d.format]}</Badge>
            {d.quantity > 1 && <Badge>{d.quantity} st</Badge>}
            {d.approved_at ? (
              <Badge tone="primary">
                <Icon name="check_circle" size={12} filled /> Godkänd
              </Badge>
            ) : d.delivered_at ? (
              <Badge tone="info">Levererad</Badge>
            ) : null}
          </div>
          {d.hook && (
            <p className="mt-2 text-body-md text-on-surface-variant">
              <span className="text-label-caps uppercase">Hook: </span>
              {d.hook}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <IconButton icon="edit" label="Ändra" onClick={onEdit} />
          <IconButton icon="delete" label="Ta bort" onClick={onDelete} danger />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant={d.delivered_at ? "quiet" : "ghost"} disabled={busy} onClick={onToggleDelivered}>
          {d.delivered_at ? `Levererad ${formatDate(d.delivered_at)}` : "Markera levererad"}
        </Button>
        {d.delivered_at && (
          <Button variant={d.approved_at ? "quiet" : "ghost"} disabled={busy} onClick={onToggleApproved}>
            {d.approved_at ? `Godkänd ${formatDate(d.approved_at)}` : "Kunden godkände"}
          </Button>
        )}
        {d.asset_url && (
          <a
            href={d.asset_url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-label-caps uppercase text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            <Icon name="link" size={16} />
            Materialet
          </a>
        )}
      </div>
    </Card>
  );
}

function LicenseRow({
  license: l,
  deliverableTitle,
  leadDays,
  onDelete,
}: {
  license: License;
  deliverableTitle: string;
  leadDays: number;
  onDelete: () => void;
}) {
  const today = new Date();
  const days = daysUntilExpiry(l, today);
  const state = licenseState(l, today, leadDays);

  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-headline-sm text-on-surface">{deliverableTitle}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {l.channels.map((c) => (
            <Badge key={c}>{CHANNEL_LABEL[c] ?? c}</Badge>
          ))}
          <Badge>{TERRITORY_LABEL[l.territory]}</Badge>
          {l.includes_raw_files && <Badge>Råmaterial ingår</Badge>}
          {l.exclusive_category && (
            <Badge tone="warn">
              <Icon name="lock" size={12} /> {l.exclusive_category}
            </Badge>
          )}
        </div>
        {l.notes && <p className="mt-2 text-body-md text-on-surface-variant">{l.notes}</p>}
      </div>

      <div className="flex shrink-0 items-start gap-2 sm:flex-col sm:items-end">
        {state === "evig" ? (
          <Badge tone="info">Evig</Badge>
        ) : state === "utgangen" ? (
          <Badge tone="neutral">Utgick {formatDateFull(l.ends_on)}</Badge>
        ) : (
          <Badge tone={state === "utgar_snart" ? "danger" : "neutral"}>
            <Icon name="schedule" size={13} />
            {daysLabel(days ?? 0)} kvar
          </Badge>
        )}
        {l.fee_sek !== null && (
          <span className="font-mono text-mono-data text-on-surface-variant">
            {formatMoney(l.fee_sek)}
          </span>
        )}
        <IconButton icon="delete" label="Ta bort licensen" onClick={onDelete} danger />
      </div>
    </Card>
  );
}

function IconButton({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={
        danger
          ? "grid h-10 w-10 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
          : "grid h-10 w-10 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container"
      }
    >
      <Icon name={icon} size={18} />
    </button>
  );
}
