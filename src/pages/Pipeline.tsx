import { Link } from "react-router-dom";
import { useBrands } from "@/hooks/useBrands";
import { BRAND_STATUS_LABEL, TIER_LABEL } from "@/types/db";
import type { Brand, BrandStatus } from "@/types/db";
import { Badge, Card, Empty } from "@/components/ui";
import { relativeDays } from "@/lib/format";

// Vunnen, forlorad och vilande hor hemma i listan, inte i pipelinen.
const COLUMNS: BrandStatus[] = ["ny", "researchad", "pitchad", "svarat", "offert"];

export default function Pipeline() {
  const { data: brands, isLoading, error } = useBrands();

  if (isLoading) return <p className="text-sm text-ink/50">Laddar...</p>;
  if (error) return <p className="text-sm text-clay">Kunde inte hämta pipelinen.</p>;

  const active = (brands ?? []).filter((b) => COLUMNS.includes(b.status));

  if (active.length === 0) {
    return (
      <Empty
        title="Inget i pipelinen än"
        hint="Lägg till ditt första varumärke under Varumärken."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Pipeline</h1>
        <span className="text-sm text-ink/45">{active.length} aktiva</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {COLUMNS.map((status) => {
          const inColumn = active.filter((b) => b.status === status);
          if (inColumn.length === 0) return null;
          return (
            <section key={status} className="space-y-2">
              <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-ink/45">
                {BRAND_STATUS_LABEL[status]} ({inColumn.length})
              </h2>
              {inColumn.map((brand) => (
                <BrandCard key={brand.id} brand={brand} />
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function BrandCard({ brand }: { brand: Brand }) {
  return (
    <Link to={`/varumarken/${brand.id}`} className="block">
      <Card className="transition hover:border-ink/25">
        <div className="flex items-start justify-between gap-3">
          <p className="font-medium">{brand.name}</p>
          <Badge tone={brand.tier === 1 ? "warm" : "neutral"}>{TIER_LABEL[brand.tier]}</Badge>
        </div>
        {brand.observation && (
          <p className="mt-1.5 line-clamp-2 text-sm text-ink/55">{brand.observation}</p>
        )}
        {brand.next_action_at && (
          <p className="mt-2 text-xs text-ink/45">Nästa steg {relativeDays(brand.next_action_at)}</p>
        )}
      </Card>
    </Link>
  );
}
