import { useState } from "react";
import type { PitchDraft } from "@/hooks/usePitches";
import type { PitchChannel, PitchStatus } from "@/types/db";
import { PITCH_CHANNEL_LABEL, PITCH_STATUS_LABEL } from "@/types/db";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";

type Draft = Omit<PitchDraft, "brand_id">;

export function PitchForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (draft: Draft) => void;
}) {
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

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          ...draft,
          subject: draft.subject?.trim() || null,
          observation: draft.observation?.trim() || null,
          sent_at: draft.status === "skickad" ? draft.sent_at : null,
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kanal">
          <Select value={draft.channel} onChange={(e) => set("channel", e.target.value as PitchChannel)}>
            {Object.entries(PITCH_CHANNEL_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={draft.status} onChange={(e) => set("status", e.target.value as PitchStatus)}>
            {Object.entries(PITCH_STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Ämne / rubrik">
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
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Skickad datum">
          <Input
            type="date"
            value={draft.sent_at ?? ""}
            onChange={(e) => set("sent_at", e.target.value)}
          />
        </Field>
        <Field label="Belopp, SEK">
          <Input
            type="number"
            min={0}
            value={draft.value_sek ?? ""}
            onChange={(e) => set("value_sek", e.target.value === "" ? null : Number(e.target.value))}
          />
        </Field>
      </div>

      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Sparar..." : "Spara pitch"}
      </Button>
    </form>
  );
}
