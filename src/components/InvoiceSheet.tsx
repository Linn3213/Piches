import type { Invoice } from "@/lib/invoice";
import { formatDateFull, formatMoney } from "@/lib/format";
import { Icon } from "@/components/ui";

/**
 * Själva fakturan, i det format den ska se ut när den skrivs ut.
 *
 * Utskrift till PDF sker i webbläsaren, alltså utan någon betaltjänst. Allt
 * som inte hör hemma på papperet, som knappar och navigering, döljs av
 * utskriftsreglerna i index.css.
 *
 * Rättigheterna redovisas som egna rader med kanaler, marknad och licenstid
 * utskrivna. Det är samma uppdelning som priset byggdes på, och den gör
 * fakturan begriplig för en ekonomiavdelning som annars bara ser en klumpsumma
 * för "UGC-samarbete" och börjar ställa frågor.
 */
export function InvoiceSheet({ invoice }: { invoice: Invoice }) {
  const v = invoice.vat;

  return (
    <article className="invoice-sheet mx-auto max-w-[210mm] bg-white p-10 text-[#1a1a1a] shadow-soft print:max-w-none print:p-0 print:shadow-none">
      <header className="flex items-start justify-between gap-8 border-b border-black/15 pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Faktura</h1>
          <table className="mt-3 text-sm">
            <tbody>
              <tr>
                <td className="pr-4 text-black/55">Fakturanummer</td>
                <td className="font-mono">{invoice.number}</td>
              </tr>
              <tr>
                <td className="pr-4 text-black/55">Fakturadatum</td>
                <td className="font-mono">{formatDateFull(invoice.issuedOn)}</td>
              </tr>
              <tr>
                <td className="pr-4 text-black/55">Förfallodag</td>
                <td className="font-mono">{formatDateFull(invoice.dueOn)}</td>
              </tr>
              <tr>
                <td className="pr-4 text-black/55">Betalningsvillkor</td>
                <td className="font-mono">{invoice.payment.termsDays} dagar</td>
              </tr>
              {invoice.buyerReference && (
                <tr>
                  <td className="pr-4 text-black/55">Er referens</td>
                  <td>{invoice.buyerReference}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="text-right text-sm leading-relaxed">
          <p className="font-semibold">{invoice.seller.name || "Ditt företag"}</p>
          {invoice.seller.address && <p>{invoice.seller.address}</p>}
          {(invoice.seller.zip || invoice.seller.city) && (
            <p>
              {invoice.seller.zip} {invoice.seller.city}
            </p>
          )}
          {invoice.seller.orgNr && <p className="mt-2">Org.nr {invoice.seller.orgNr}</p>}
          {invoice.seller.vatNr && <p>Momsreg.nr {invoice.seller.vatNr}</p>}
          {invoice.seller.email && <p className="mt-2">{invoice.seller.email}</p>}
        </div>
      </header>

      <section className="mt-6">
        <p className="text-xs uppercase tracking-wide text-black/45">Faktureras</p>
        <p className="mt-1 font-semibold">{invoice.buyer.name}</p>
        {invoice.buyer.address && <p className="text-sm">{invoice.buyer.address}</p>}
        {(invoice.buyer.zip || invoice.buyer.city) && (
          <p className="text-sm">
            {invoice.buyer.zip} {invoice.buyer.city}
          </p>
        )}
        {invoice.buyer.country !== "SE" && <p className="text-sm">{invoice.buyer.country}</p>}
        {invoice.buyer.orgNr && <p className="mt-1 text-sm">Org.nr {invoice.buyer.orgNr}</p>}
        {invoice.buyer.vatNr && <p className="text-sm">Momsreg.nr {invoice.buyer.vatNr}</p>}
      </section>

      <table className="mt-8 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-black/20 text-left">
            <th className="pb-2 font-medium text-black/55">Beskrivning</th>
            <th className="pb-2 text-right font-medium text-black/55">Belopp</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((l, i) => (
            <tr key={i} className="border-b border-black/10 align-top">
              <td className="py-3 pr-4">
                <p>{l.description}</p>
                {l.detail && <p className="mt-0.5 text-xs text-black/55">{l.detail}</p>}
              </td>
              <td className="py-3 text-right font-mono whitespace-nowrap">
                {formatMoney(l.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex justify-end">
        <table className="text-sm">
          <tbody>
            <tr>
              <td className="pr-8 py-1 text-black/55">Summa exklusive moms</td>
              <td className="py-1 text-right font-mono">{formatMoney(invoice.totals.net)}</td>
            </tr>
            <tr>
              <td className="pr-8 py-1 text-black/55">
                Moms {invoice.totals.rate > 0 ? `${invoice.totals.rate} %` : ""}
              </td>
              <td className="py-1 text-right font-mono">{formatMoney(invoice.totals.vat)}</td>
            </tr>
            <tr className="border-t border-black/20">
              <td className="pr-8 pt-2 font-semibold">Att betala</td>
              <td className="pt-2 text-right font-mono text-lg font-semibold">
                {formatMoney(invoice.totals.gross)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {v.invoiceNote && (
        <p className="mt-6 border-l-2 border-black/30 pl-3 text-sm">{v.invoiceNote}</p>
      )}

      <footer className="mt-10 border-t border-black/15 pt-5 text-sm">
        <div className="flex flex-wrap gap-x-10 gap-y-2">
          {invoice.payment.bankgiro && (
            <p>
              <span className="text-black/55">Bankgiro </span>
              <span className="font-mono">{invoice.payment.bankgiro}</span>
            </p>
          )}
          {invoice.payment.swish && (
            <p>
              <span className="text-black/55">Swish </span>
              <span className="font-mono">{invoice.payment.swish}</span>
            </p>
          )}
          {invoice.payment.iban && (
            <p>
              <span className="text-black/55">IBAN </span>
              <span className="font-mono">{invoice.payment.iban}</span>
            </p>
          )}
          {invoice.payment.bic && (
            <p>
              <span className="text-black/55">BIC </span>
              <span className="font-mono">{invoice.payment.bic}</span>
            </p>
          )}
        </div>
        {invoice.hasFSkatt && (
          <p className="mt-4 text-black/55">
            Godkänd för F-skatt. Vid betalning efter förfallodagen debiteras dröjsmålsränta enligt
            räntelagen.
          </p>
        )}
      </footer>
    </article>
  );
}

/** Bristerna visas på skärmen men följer aldrig med till papperet. */
export function InvoiceProblems({ problems }: { problems: string[] }) {
  if (problems.length === 0) return null;
  return (
    <div className="print:hidden rounded-xl border border-error/30 bg-error-container/40 p-5">
      <div className="flex items-center gap-2 text-on-error-container">
        <Icon name="warning" filled size={18} />
        <p className="text-label-caps uppercase">Fyll i det här först</p>
      </div>
      <ul className="mt-3 space-y-1.5">
        {problems.map((p) => (
          <li key={p} className="text-body-md text-on-error-container">
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}
