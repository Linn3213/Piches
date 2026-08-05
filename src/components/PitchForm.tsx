import { useState } from "react";
import type { PitchDraft } from "@/hooks/usePitches";
import type { Brand, PitchChannel, PitchStatus } from "@/types/db";
import { DEAL_PIPELINE, PITCH_CHANNEL_LABEL, PITCH_STATUS_LABEL } from "@/types/db";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";

type Draft = Omit<PitchDraft, "brand_id">;

export function PitchForm({
  busy,
  brands,
  onSubmit,
}: {
  busy: boolean;
  /** Anges när uppdraget skapas utanför ett varumärke, då behövs en väljare. */
  brands?: Brand[];
  onSubmit: (draft: Draft & { brand_id?: string }) => void;
}) {
  const [brandId, setBrandId] = useState("");
  const [draft, setDraft] = useState<Draft>({
    status: "skickad",
    channel: "mejl",
    subject: "",
    observation: "",
    value_sek: null,
    sent_at: new Date().toISOString().slice(0, 10),
  });

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  const needsBrand = brands !== undefined;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          ...draft,
          ...(needsBrand ? { brand_id: brandId } : {}),
          subject: draft.subject?.trim() || null,
          observation: draft.observation?.trim() || null,
          // Tom strang far aldrig na databasen: Postgres kastar da ett fel som
          // ingen av modalerna visar, sa sparandet misslyckades helt tyst.
          sent_at: draft.status === "utkast" ? null : draft.sent_at || null,
        });
      }}
    >
      {needsBrand && (
        <Field label="Varumärke">
          <Select required value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">Välj varumärke</option>
            {brands!.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Kanal">
          <Select
            value={draft.channel}
            onChange={(e) => set("channel", e.target.value as PitchChannel)}
          >
            {Object.entries(PITCH_CHANNEL_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Var i uppdraget">
          <Select
            value={draft.status}
            onChange={(e) => set("status", e.target.value as PitchStatus)}
          >
            {DEAL_PIPELINE.map((value) => (
              <option key={value} value={value}>
                {PITCH_STATUS_LABEL[value]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Rubrik">
        <Input
          value={draft.subject ?? ""}
          onChange={(e) => set("subject", e.target.value)}
          placeholder="UGC-samarbete med Verso Skincare"
        />
      </Field>

      <Field label="Observationen pitchen bygger på">
        <Textarea
          value={draft.observation ?? ""}
          onChange={(e) => set("observation", e.target.value)}
          placeholder="Lanserade ny serumlinje i mars, kör bara statiska annonser"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Skickad">
          <Input
            type="date"
            value={draft.sent_at ?? ""}
            onChange={(e) => set("sent_at", e.target.value)}
            disabled={draft.status === "utkast"}
          />
        </Field>
        <Field label="Ordervärde, kronor" hint="Exklusive moms.">
          <Input
            type="number"
            min={0}
            step={100}
            value={draft.value_sek ?? ""}
            onChange={(e) => set("value_sek", e.target.value === "" ? null : Number(e.target.value))}
          />
        </Field>
      </div>

      <Button type="submit" disabled={busy || (needsBrand && !brandId)} className="w-full">
        {busy ? "Sparar..." : "Spara uppdraget"}
      </Button>
    </form>
  );
}
