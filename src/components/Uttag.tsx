import { useState } from "react";
import { useBrands } from "@/hooks/useBrands";
import { usePitches } from "@/hooks/usePitches";
import { useDeliverables } from "@/hooks/useDeliverables";
import { useLicenses } from "@/hooks/useLicenses";
import { useProducts } from "@/hooks/useProducts";
import { useSettings } from "@/hooks/useSettings";
import { Button, Card, Icon } from "@/components/ui";
import {
  alltSomJson,
  filnamn,
  licenserSomCsv,
  uppdragSomCsv,
  type Underlag,
} from "@/lib/export";

/**
 * Ta med dig allt och gå.
 *
 * Den som ska lägga in ett år av licenser och utgångsdatum vill veta att hon
 * kan få ut dem igen, och det är en helt rimlig fråga att ställa INNAN hon
 * betalar. Utan ett svar är verktyget en fälla, och ett verktyg som håller
 * kvar sitt folk för att materialet sitter fast har inte förtjänat att de
 * stannar.
 *
 * Filerna skapas i webbläsaren av data hon redan har på skärmen, så det finns
 * ingen server som kan säga nej och ingenting att vänta på.
 */
export function Uttag() {
  const { data: brands } = useBrands();
  const { data: pitches } = usePitches();
  const { data: deliverables } = useDeliverables();
  const { data: licenses } = useLicenses();
  const { data: products } = useProducts();
  const { data: settings } = useSettings();
  const [senast, setSenast] = useState<string | null>(null);

  const klart = Boolean(brands && pitches && deliverables && licenses && products);

  function underlag(): Underlag {
    return {
      brands: brands ?? [],
      pitches: pitches ?? [],
      deliverables: deliverables ?? [],
      licenses: licenses ?? [],
      products: products ?? [],
      settings: settings ?? null,
    };
  }

  function ladda(innehall: string, namn: string, typ: string) {
    const url = URL.createObjectURL(new Blob([innehall], { type: typ }));
    const a = document.createElement("a");
    a.href = url;
    a.download = namn;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Utan revoke ligger filen kvar i minnet tills fliken stängs, och den som
    // tar ut allt gör det oftast flera gånger i rad.
    URL.revokeObjectURL(url);
    setSenast(namn);
  }

  const nu = new Date();

  return (
    <Card>
      <div className="flex items-start gap-3">
        <Icon name="download" size={22} className="mt-0.5 shrink-0 text-primary" />
        <div>
          <h2 className="text-headline-sm text-on-surface">Ta ut allt ditt material</h2>
          <p className="mt-1 max-w-prose text-body-md text-on-surface-variant">
            Allt du lagt in är ditt och går att hämta ut när du vill, utan att fråga någon. Filerna
            skapas här i webbläsaren och skickas ingenstans.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button
          variant="ghost"
          disabled={!klart}
          onClick={() =>
            ladda(licenserSomCsv(underlag()), filnamn("licenser", nu, "csv"), "text/csv;charset=utf-8")
          }
        >
          Licenserna som kalkylark
        </Button>
        <Button
          variant="ghost"
          disabled={!klart}
          onClick={() =>
            ladda(uppdragSomCsv(underlag()), filnamn("uppdrag", nu, "csv"), "text/csv;charset=utf-8")
          }
        >
          Uppdragen som kalkylark
        </Button>
        <Button
          variant="ghost"
          disabled={!klart}
          onClick={() =>
            ladda(
              alltSomJson(underlag(), nu.toISOString()),
              filnamn("allt", nu, "json"),
              "application/json",
            )
          }
        >
          Allting som en fil
        </Button>
      </div>

      <p className="mt-4 text-body-md text-on-surface-variant">
        Kalkylarken öppnas direkt i Excel eller Numbers. Filen med allting innehåller varje rad
        precis som den ligger, och den är den du vill ha om du någon gång ska flytta någon
        annanstans.
      </p>
      {senast && (
        <p className="mt-3 text-body-md text-primary" role="status">
          {senast} är hämtad.
        </p>
      )}
    </Card>
  );
}
