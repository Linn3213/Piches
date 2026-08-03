import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useBrands, useCreateBrand } from "@/hooks/useBrands";
import { BRAND_STATUS_LABEL, TIER_LABEL } from "@/types/db";
import type { BrandStatus } from "@/types/db";
import { BRAND_STATUSES } from "@/types/db";
import { Badge, Button, Card, Empty, Input, Modal, Select } from "@/components/ui";
import { BrandForm } from "@/components/BrandForm";

export default function Brands() {
  const { data: brands, isLoading } = useBrands();
  const create = useCreateBrand();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<BrandStatus | "alla">("alla");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (brands ?? []).filter((b) => {
      if (filter !== "alla" && b.status !== filter) return false;
      if (!needle) return true;
      return (
        b.name.toLowerCase().includes(needle) ||
        (b.contact_name ?? "").toLowerCase().includes(needle) ||
        (b.observation ?? "").toLowerCase().includes(needle)
      );
    });
  }, [brands, query, filter]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Varumärken</h1>
        <Button onClick={() => setOpen(true)}>Lägg till</Button>
      </div>

      <div className="flex gap-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sök varumärke, kontakt eller observation"
        />
        <Select
          className="w-44"
          value={filter}
          onChange={(e) => setFilter(e.target.value as BrandStatus | "alla")}
        >
          <option value="alla">Alla statusar</option>
          {BRAND_STATUSES.map((s) => (
            <option key={s} value={s}>
              {BRAND_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-ink/50">Laddar...</p>
      ) : visible.length === 0 ? (
        <Empty
          title={brands?.length ? "Inga träffar" : "Inga varumärken än"}
          hint={brands?.length ? "Prova en annan sökning." : "Lägg till det första för att komma igång."}
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((brand) => (
            <li key={brand.id}>
              <Link to={`/varumarken/${brand.id}`}>
                <Card className="flex items-center justify-between gap-3 transition hover:border-ink/25">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{brand.name}</p>
                    <p className="mt-0.5 text-sm text-ink/50">
                      {BRAND_STATUS_LABEL[brand.status]}
                      {brand.contact_name ? ` · ${brand.contact_name}` : ""}
                    </p>
                  </div>
                  <Badge tone={brand.tier === 1 ? "warm" : "neutral"}>{TIER_LABEL[brand.tier]}</Badge>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} title="Nytt varumärke" onClose={() => setOpen(false)}>
        <BrandForm
          submitLabel="Spara varumärke"
          busy={create.isPending}
          onSubmit={(draft) =>
            create.mutate(draft, {
              onSuccess: () => setOpen(false),
            })
          }
        />
        {create.isError && (
          <p className="mt-3 text-sm text-clay">Det gick inte att spara. Försök igen.</p>
        )}
      </Modal>
    </div>
  );
}
