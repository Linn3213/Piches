import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useActivities } from "@/hooks/useActivities";
import { useBrand, useDeleteBrand, useUpdateBrand } from "@/hooks/useBrands";
import { useCreatePitch, usePitches, useUpdatePitch } from "@/hooks/usePitches";
import {
  BRAND_STATUS_LABEL,
  PITCH_CHANNEL_LABEL,
  PITCH_STATUS_LABEL,
  TIER_LABEL,
} from "@/types/db";
import type { PitchStatus } from "@/types/db";
import { Badge, Button, Card, Empty, Modal, Select } from "@/components/ui";
import { BrandForm } from "@/components/BrandForm";
import { PitchForm } from "@/components/PitchForm";
import { formatDate, formatMoney } from "@/lib/format";

export default function BrandDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: brand, isLoading, error } = useBrand(id);
  const { data: pitches } = usePitches(id);
  const { data: activities } = useActivities(id);
  const updateBrand = useUpdateBrand();
  const deleteBrand = useDeleteBrand();
  const createPitch = useCreatePitch();
  const updatePitch = useUpdatePitch();

  const [editOpen, setEditOpen] = useState(false);
  const [pitchOpen, setPitchOpen] = useState(false);

  if (!id) return <Navigate to="/varumarken" replace />;
  if (isLoading) return <p className="text-sm text-on-surface-variant">Laddar...</p>;
  if (error || !brand) return <p className="text-sm text-error">Hittade inte varumärket.</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/varumarken" className="text-sm text-on-surface-variant hover:text-on-surface">
          ← Varumärken
        </Link>
      </div>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{brand.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={brand.tier === 1 ? "primary" : "neutral"}>{TIER_LABEL[brand.tier]}</Badge>
              <StatusPicker
                value={brand.status}
                onChange={(status) => updateBrand.mutate({ id: brand.id, patch: { status } })}
              />
            </div>
          </div>
          <Button variant="ghost" onClick={() => setEditOpen(true)}>
            Redigera
          </Button>
        </div>

        {brand.observation && (
          <p className="mt-4 rounded-xl bg-background px-3 py-2.5 text-sm text-on-surface-variant">
            {brand.observation}
          </p>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {brand.contact_name && (
            <div>
              <dt className="text-on-surface-variant">Kontakt</dt>
              <dd>{brand.contact_name}</dd>
            </div>
          )}
          {brand.contact_email && (
            <div>
              <dt className="text-on-surface-variant">Mejl</dt>
              <dd className="truncate">{brand.contact_email}</dd>
            </div>
          )}
          {brand.website && (
            <div>
              <dt className="text-on-surface-variant">Webbplats</dt>
              <dd className="truncate">{brand.website}</dd>
            </div>
          )}
          {brand.instagram && (
            <div>
              <dt className="text-on-surface-variant">Instagram</dt>
              <dd>{brand.instagram}</dd>
            </div>
          )}
        </dl>

        {brand.notes && <p className="mt-4 whitespace-pre-wrap text-sm text-on-surface-variant">{brand.notes}</p>}

        <button
          onClick={() => {
            if (confirm(`Ta bort ${brand.name}? Detta går inte att ångra.`)) {
              deleteBrand.mutate(brand.id, { onSuccess: () => navigate("/varumarken") });
            }
          }}
          className="mt-4 text-xs text-error hover:text-error"
        >
          Ta bort varumärke
        </button>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-on-surface-variant">Pitchar</h2>
          <Button variant="ghost" onClick={() => setPitchOpen(true)}>
            Ny pitch
          </Button>
        </div>

        {!pitches?.length ? (
          <Empty title="Inga pitchar än" hint="Registrera pitchen när du skickat den." />
        ) : (
          <ul className="space-y-2">
            {pitches.map((pitch) => (
              <li key={pitch.id}>
                <Card>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        {pitch.subject || PITCH_CHANNEL_LABEL[pitch.channel]}
                      </p>
                      <p className="mt-0.5 text-xs text-on-surface-variant">
                        {pitch.sent_at ? formatDate(pitch.sent_at) : "Ej skickad"}
                        {pitch.value_sek ? ` · ${formatMoney(pitch.value_sek)}` : ""}
                      </p>
                    </div>
                    <Select
                      className="w-36"
                      value={pitch.status}
                      onChange={(e) =>
                        updatePitch.mutate({
                          id: pitch.id,
                          patch: { status: e.target.value as PitchStatus },
                        })
                      }
                    >
                      {Object.entries(PITCH_STATUS_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-on-surface-variant">Historik</h2>
        {!activities?.length ? (
          <p className="text-sm text-on-surface-variant">Inget loggat än.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {activities.map((a) => (
              <li key={a.id} className="flex justify-between gap-3 text-on-surface-variant">
                <span>{a.body}</span>
                <span className="shrink-0 text-on-surface-variant">{formatDate(a.occurred_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal open={editOpen} title="Redigera varumärke" onClose={() => setEditOpen(false)}>
        <BrandForm
          initial={brand}
          submitLabel="Spara"
          busy={updateBrand.isPending}
          onSubmit={(patch) =>
            updateBrand.mutate({ id: brand.id, patch }, { onSuccess: () => setEditOpen(false) })
          }
        />
      </Modal>

      <Modal open={pitchOpen} title="Ny pitch" onClose={() => setPitchOpen(false)}>
        <PitchForm
          busy={createPitch.isPending}
          onSubmit={(draft) =>
            createPitch.mutate(
              { ...draft, brand_id: brand.id },
              { onSuccess: () => setPitchOpen(false) },
            )
          }
        />
      </Modal>
    </div>
  );
}

function StatusPicker({
  value,
  onChange,
}: {
  value: keyof typeof BRAND_STATUS_LABEL;
  onChange: (status: keyof typeof BRAND_STATUS_LABEL) => void;
}) {
  return (
    <Select
      className="w-40"
      value={value}
      onChange={(e) => onChange(e.target.value as keyof typeof BRAND_STATUS_LABEL)}
    >
      {Object.entries(BRAND_STATUS_LABEL).map(([status, label]) => (
        <option key={status} value={status}>
          {label}
        </option>
      ))}
    </Select>
  );
}
