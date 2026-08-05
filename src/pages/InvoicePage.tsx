import { useMemo } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useBrand } from "@/hooks/useBrands";
import { usePitch, useUpdatePitch } from "@/hooks/usePitches";
import { useDeliverables } from "@/hooks/useDeliverables";
import { useLicenses } from "@/hooks/useLicenses";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import { buildInvoice } from "@/lib/invoice";
import { InvoiceProblems, InvoiceSheet } from "@/components/InvoiceSheet";
import { Button, Card, Icon, Loading } from "@/components/ui";

/**
 * Fakturasidan.
 *
 * Appen skapar dokumentet, bokföringssystemet äger arkivet. Därför sparas här
 * bara fakturanumret och datumen på affären, aldrig något verifikat.
 *
 * Numret räknas upp först när fakturan faktiskt bokförs, inte när den visas,
 * så att man kan titta på underlaget hur många gånger som helst utan att
 * bränna hål i nummerserien.
 */
export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { data: deal, isLoading } = usePitch(id);
  const { data: brand } = useBrand(deal?.brand_id);
  const { data: deliverables } = useDeliverables(id);
  const { data: allLicenses } = useLicenses();
  const { data: settings } = useSettings();
  const updateDeal = useUpdatePitch();
  const updateSettings = useUpdateSettings();

  const licenses = useMemo(
    () => (allLicenses ?? []).filter((l) => l.pitch_id === id),
    [allLicenses, id],
  );

  const invoice = useMemo(() => {
    if (!deal || !brand || !settings) return null;
    return buildInvoice({
      deal,
      brand,
      deliverables: deliverables ?? [],
      licenses,
      settings,
      today: new Date(),
    });
  }, [deal, brand, deliverables, licenses, settings]);

  if (!id) return <Navigate to="/uppdrag" replace />;
  if (isLoading || !invoice || !deal || !settings) return <Loading />;

  const alreadyBooked = Boolean(deal.invoice_number);

  function bookInvoice() {
    if (!invoice || !deal || !settings) return;
    updateDeal.mutate({
      id: deal.id,
      patch: {
        invoice_number: invoice.number,
        invoiced_on: invoice.issuedOn,
        due_on: invoice.dueOn,
        status: deal.status === "betalt" ? deal.status : "fakturerat",
      },
    });
    // Nummerserien far inte aterandvandas, sa den rakans upp i samma veva.
    updateSettings.mutate({ invoice_next_number: settings.invoice_next_number + 1 });
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <Link
          to={`/uppdrag/${deal.id}`}
          className="inline-flex items-center gap-1 text-body-md text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <Icon name="arrow_back" size={16} />
          Tillbaka till uppdraget
        </Link>
      </div>

      <div className="print:hidden flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-headline-lg text-on-background">Fakturaunderlag</h1>
          <p className="mt-1 max-w-prose text-body-md text-on-surface-variant">
            Skriv ut till PDF och skicka den som vanligt. Bokför den sedan i ditt
            bokföringsprogram, det är där den ska sparas.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="ghost" onClick={() => window.print()}>
            Skriv ut
          </Button>
          <Button
            onClick={bookInvoice}
            disabled={invoice.problems.length > 0 || alreadyBooked || updateDeal.isPending}
          >
            {alreadyBooked ? `Bokförd som ${deal.invoice_number}` : "Markera som fakturerad"}
          </Button>
        </div>
      </div>

      <div className="print:hidden">
        <InvoiceProblems problems={invoice.problems} />
      </div>

      <Card className="print:hidden">
        <div className="flex items-start gap-3">
          <Icon name="receipt_long" size={18} className="mt-0.5 shrink-0 text-primary" />
          <div>
            <p className="text-body-md text-on-surface">{invoice.vat.label}</p>
            <p className="mt-1 max-w-prose text-body-md text-on-surface-variant">
              {invoice.vat.reason}
            </p>
            {invoice.vat.warning && (
              <p className="mt-2 max-w-prose text-body-md text-error">{invoice.vat.warning}</p>
            )}
          </div>
        </div>
      </Card>

      <InvoiceSheet invoice={invoice} />

      <p className="print:hidden text-center text-xs text-on-surface-variant/70">
        Momsbehandlingen är ett förslag byggt på kundens land och momsnummer. Stäm av udda fall med
        din redovisning innan du skickar.
      </p>
    </div>
  );
}
