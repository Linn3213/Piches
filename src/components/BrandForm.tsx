import { useState } from "react";
import type { BrandDraft } from "@/hooks/useBrands";
import type { Brand, BrandStatus } from "@/types/db";
import { BRAND_STATUSES, BRAND_STATUS_LABEL, TIER_LABEL } from "@/types/db";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";

export function BrandForm({
  initial,
  submitLabel,
  busy,
  onSubmit,
}: {
  initial?: Brand;
  submitLabel: string;
  busy: boolean;
  onSubmit: (draft: BrandDraft) => void;
}) {
  const [draft, setDraft] = useState<BrandDraft>({
    name: initial?.name ?? "",
    website: initial?.website ?? "",
    instagram: initial?.instagram ?? "",
    contact_name: initial?.contact_name ?? "",
    contact_email: initial?.contact_email ?? "",
    tier: initial?.tier ?? 2,
    status: initial?.status ?? "ny",
    source: initial?.source ?? "",
    observation: initial?.observation ?? "",
    notes: initial?.notes ?? "",
  });

  function set<K extends keyof BrandDraft>(key: K, value: BrandDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        // Tomma strangar sparas som null sa att databasen slipper skrapvarden.
        const clean = Object.fromEntries(
          Object.entries(draft).map(([k, v]) => [k, v === "" ? null : v]),
        ) as BrandDraft;
        onSubmit({ ...clean, name: draft.name.trim() });
      }}
    >
      <Field label="Varumärke">
        <Input
          required
          autoFocus
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Verso Skincare"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Nivå">
          <Select
            value={draft.tier}
            onChange={(e) => set("tier", Number(e.target.value) as 1 | 2 | 3)}
          >
            {([1, 2, 3] as const).map((t) => (
              <option key={t} value={t}>
                {TIER_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select
            value={draft.status}
            onChange={(e) => set("status", e.target.value as BrandStatus)}
          >
            {BRAND_STATUSES.map((s) => (
              <option key={s} value={s}>
                {BRAND_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Observation, det pitchen ska bygga på">
        <Textarea
          value={draft.observation ?? ""}
          onChange={(e) => set("observation", e.target.value)}
          placeholder="Lanserade ny serumlinje i mars, kör bara statiska annonser"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Kontaktperson">
          <Input
            value={draft.contact_name ?? ""}
            onChange={(e) => set("contact_name", e.target.value)}
          />
        </Field>
        <Field label="Mejl">
          <Input
            type="email"
            value={draft.contact_email ?? ""}
            onChange={(e) => set("contact_email", e.target.value)}
          />
        </Field>
        <Field label="Webbplats">
          <Input value={draft.website ?? ""} onChange={(e) => set("website", e.target.value)} />
        </Field>
        <Field label="Instagram">
          <Input
            value={draft.instagram ?? ""}
            onChange={(e) => set("instagram", e.target.value)}
            placeholder="@versoskincare"
          />
        </Field>
      </div>

      <Field label="Anteckningar">
        <Textarea value={draft.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
      </Field>

      <Button type="submit" disabled={busy || !draft.name.trim()} className="w-full">
        {busy ? "Sparar..." : submitLabel}
      </Button>
    </form>
  );
}
