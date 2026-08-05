import { useState } from "react";
import type { DeliverableDraft } from "@/hooks/useDeliverables";
import type { Deliverable, DeliverableFormat } from "@/types/db";
import { FORMAT_LABEL } from "@/types/db";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";

const FORMATS: DeliverableFormat[] = [
  "video",
  "reel",
  "tiktok",
  "ugc_ad",
  "foto",
  "story",
  "annat",
];

/**
 * En leverabel är den konkreta sak du producerar, och den är också det
 * rättigheterna hänger på. Hooken har ett eget fält eftersom den i UGC inte
 * är en anteckning utan själva produkten: presterar inte första sekunden
 * spelar resten av filmen ingen roll.
 */
export function DeliverableForm({
  initial,
  busy,
  submitLabel,
  onSubmit,
}: {
  initial?: Deliverable;
  busy: boolean;
  submitLabel: string;
  onSubmit: (draft: Omit<DeliverableDraft, "pitch_id" | "brand_id">) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [format, setFormat] = useState<DeliverableFormat>(initial?.format ?? "video");
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
  const [hook, setHook] = useState(initial?.hook ?? "");
  const [script, setScript] = useState(initial?.script ?? "");
  const [assetUrl, setAssetUrl] = useState(initial?.asset_url ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          title: title.trim(),
          format,
          quantity,
          hook: hook.trim() || null,
          script: script.trim() || null,
          asset_url: assetUrl.trim() || null,
          notes: notes.trim() || null,
        });
      }}
    >
      <Field label="Vad du levererar">
        <Input
          required
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Unboxning av nattserumet"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Format">
          <Select value={format} onChange={(e) => setFormat(e.target.value as DeliverableFormat)}>
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {FORMAT_LABEL[f]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Antal">
          <Input
            type="number"
            min={1}
            max={999}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          />
        </Field>
      </div>

      <Field label="Hook" hint="Första sekunden. Den avgör om resten ens blir sedd.">
        <Input
          value={hook}
          onChange={(e) => setHook(e.target.value)}
          placeholder="Jag trodde att mitt serum var problemet"
        />
      </Field>

      <Field label="Manus">
        <Textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="Scen för scen, eller bara stolpar att hålla sig till"
        />
      </Field>

      <Field label="Länk till materialet">
        <Input
          type="url"
          value={assetUrl}
          onChange={(e) => setAssetUrl(e.target.value)}
          placeholder="https://drive.google.com/..."
        />
      </Field>

      <Field label="Anteckning">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <Button type="submit" disabled={busy || !title.trim()} className="w-full">
        {busy ? "Sparar..." : submitLabel}
      </Button>
    </form>
  );
}
