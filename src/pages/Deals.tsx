import { Link } from "react-router-dom";
import { useBrands } from "@/hooks/useBrands";
import { usePitches } from "@/hooks/usePitches";
import { useLicenses } from "@/hooks/useLicenses";
import { BRAND_STATUS_LABEL, TIER_LABEL, type Brand, type BrandStatus } from "@/types/db";
import { formatMoney } from "@/lib/format";
import { Badge, Card, Empty, Icon, Loading, PageHeader } from "@/components/ui";

// Vunnen, förlorad och vilande hör hemma i listan, inte i pipelinen.
const COLUMNS: BrandStatus[] = ["ny", "researchad", "pitchad", "svarat", "offert"];

export default function Deals() {
  const { data: brands, isLoading, error } = useBrands();
  const { data: pitches } = usePitches();
  const { data: licenses } = useLicenses();

  if (isLoading) return <Loading />;
  if (error) return <p className="text-body-md text-error">Kunde inte hämta pipelinen.</p>;

  const active = (brands ?? []).filter((b) => COLUMNS.includes(b.status));
  const pipelineValue = (pitches ?? [])
    .filter((p) => ["skickad", "svarat", "offert"].includes(p.status))
    .reduce((sum, p) => sum + (p.value_sek ?? 0), 0);

  const licenseCount = (brandId: string) =>
    (licenses ?? []).filter((l) => l.brand_id === brandId).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Uppdrag"
        subtitle="Från förfrågan till signerat. Rättigheterna registreras när uppdraget vinns."
        action={
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">{active.length} aktiva</Badge>
            {pipelineValue > 0 && <Badge tone="primary">{formatMoney(pipelineValue)} i pipeline</Badge>}
          </div>
        }
      />

      {active.length === 0 ? (
        <Empty
          icon="handshake"
          title="Inget i pipelinen än"
          hint="Lägg till ditt första varumärke under Varumärken."
        />
      ) : (
        <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-4 no-scrollbar md:mx-0 md:px-0">
          {COLUMNS.map((status) => {
            const inColumn = active.filter((b) => b.status === status);
            return (
              <section
                key={status}
                className="flex min-h-[280px] w-[290px] shrink-0 flex-col rounded-2xl border border-outline-variant/30 bg-surface-container p-4"
              >
                <div className="mb-4 flex items-center justify-between border-b border-outline-variant/30 pb-3">
                  <span className="text-label-caps uppercase text-on-surface-variant">
                    {BRAND_STATUS_LABEL[status]}
                  </span>
                  <span className="rounded-full bg-surface-container-highest px-2.5 py-1 font-mono text-xs">
                    {inColumn.length}
                  </span>
                </div>

                {inColumn.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-outline-variant/30">
                    <span className="text-body-md text-on-surface-variant/60">Tom</span>
                  </div>
                ) : (
                  <ul className="flex-1 space-y-3">
                    {inColumn.map((brand) => (
                      <li key={brand.id}>
                        <DealCard brand={brand} licenses={licenseCount(brand.id)} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DealCard({ brand, licenses }: { brand: Brand; licenses: number }) {
  return (
    <Link to={`/varumarken/${brand.id}`} className="block">
      <Card className="p-5 transition-all hover:-translate-y-0.5 hover:shadow-soft">
        <div className="flex items-start justify-between gap-2">
          <p className="text-label-caps uppercase text-primary">{brand.name}</p>
          {brand.tier === 1 && <Icon name="star" filled size={16} className="text-sand" />}
        </div>
        {brand.observation && (
          <p className="mt-2 line-clamp-2 text-body-md text-on-surface-variant">
            {brand.observation}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge>{TIER_LABEL[brand.tier]}</Badge>
          {licenses > 0 && (
            <Badge tone="info">
              <Icon name="gavel" size={12} /> {licenses}
            </Badge>
          )}
        </div>
      </Card>
    </Link>
  );
}
