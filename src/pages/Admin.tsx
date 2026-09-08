import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Badge, Card, Icon, Loading, PageHeader } from "@/components/ui";
import { formatDateFull } from "@/lib/format";

/**
 * Vilka som skapat konto.
 *
 * Utan den här sidan fanns det ingen väg alls att se vem som registrerat sig.
 * auth.users går inte att läsa från webbläsaren, och det ska den inte heller,
 * så listan hämtas från en databasfunktion som kontrollerar VEM som frågar
 * innan den svarar. En vy med utökade rättigheter hade gått förbi den
 * kontrollen, och det misstaget är redan gjort en gång i det här projektet.
 *
 * Sidan visar mejladressen, för det är den enda uppgiften som faktiskt behövs
 * för att höra av sig till någon som fastnat.
 */

type Konto = {
  user_id: string;
  email: string;
  skapad: string;
  senast_inloggad: string | null;
  status: string;
  niva: string;
  provperiod_slutar: string | null;
  oppnad_for_hand: boolean;
  samtycke: boolean;
  samtycke_at: string | null;
  pa_maillista: boolean;
  antal_uppdrag: number;
  antal_licenser: number;
};

function useKonton() {
  return useQuery({
    queryKey: ["admin-konton"],
    queryFn: async (): Promise<Konto[]> => {
      const { data, error } = await supabase.rpc("piches_admin_konton");
      if (error) throw error;
      return (data ?? []) as Konto[];
    },
  });
}

const TON: Record<string, "primary" | "warn" | "danger" | "neutral"> = {
  aktiv: "primary",
  provperiod: "warn",
  uppsagd: "neutral",
  forfallen: "danger",
};

export default function Admin() {
  const { data: konton, isLoading, error } = useKonton();

  if (isLoading) return <Loading />;
  if (error) {
    return (
      <p className="text-body-md text-error">
        Kunde inte hämta kontona. Är du inloggad med rätt adress?
      </p>
    );
  }

  const rader = konton ?? [];
  const betalande = rader.filter((k) => k.status === "aktiv" && !k.oppnad_for_hand).length;
  const prov = rader.filter((k) => k.status === "provperiod").length;
  const medSamtycke = rader.filter((k) => k.samtycke).length;
  const paLista = rader.filter((k) => k.pa_maillista).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Konton"
        subtitle="Alla som skapat konto, vad de har för status och om de sagt ja till mejl."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { etikett: "Konton totalt", varde: rader.length },
          { etikett: "Provperiod", varde: prov },
          { etikett: "Betalande", varde: betalande },
          { etikett: "Ja till mejl", varde: `${medSamtycke} av ${rader.length}` },
        ].map((s) => (
          <Card key={s.etikett}>
            <p className="text-label-caps uppercase text-on-surface-variant">{s.etikett}</p>
            <p className="mt-1 font-mono text-headline-md text-on-surface">{s.varde}</p>
          </Card>
        ))}
      </div>

      {medSamtycke > paLista && (
        <Card className="border-l-2 border-l-error">
          <p className="text-body-md text-on-surface">
            {medSamtycke - paLista} personer har sagt ja till mejl men ligger inte på maillistan
            än. Det betyder att synken mot MailerLite inte gått igenom för dem.
          </p>
        </Card>
      )}

      {rader.length === 0 ? (
        <Card>
          <p className="text-body-md text-on-surface-variant">Ingen har skapat konto än.</p>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/50 text-left">
                {["Mejladress", "Status", "Skapad", "Senast inne", "Innehåll", "Mejl"].map((h) => (
                  <th key={h} className="py-3 pr-4 text-label-caps uppercase text-on-surface-variant">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rader.map((k) => (
                <tr key={k.user_id} className="border-b border-outline-variant/30 align-top">
                  <td className="py-3 pr-4">
                    <a
                      href={`mailto:${k.email}`}
                      className="text-body-md text-on-surface underline decoration-outline-variant underline-offset-2 transition-colors hover:decoration-on-surface"
                    >
                      {k.email}
                    </a>
                    {k.oppnad_for_hand && (
                      <span className="mt-1 block text-xs text-on-surface-variant">
                        öppnat för hand
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <Badge tone={TON[k.status] ?? "neutral"}>{k.status}</Badge>
                    {k.status === "provperiod" && k.provperiod_slutar && (
                      <span className="mt-1 block text-xs text-on-surface-variant">
                        till {formatDateFull(k.provperiod_slutar)}
                      </span>
                    )}
                    {k.status === "aktiv" && !k.oppnad_for_hand && (
                      <span className="mt-1 block text-xs text-on-surface-variant">{k.niva}</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 font-mono text-mono-data text-on-surface-variant">
                    {formatDateFull(k.skapad)}
                  </td>
                  <td className="py-3 pr-4 font-mono text-mono-data text-on-surface-variant">
                    {k.senast_inloggad ? formatDateFull(k.senast_inloggad) : "aldrig"}
                  </td>
                  <td className="py-3 pr-4 text-body-md text-on-surface-variant">
                    {k.antal_uppdrag} uppdrag, {k.antal_licenser} licenser
                  </td>
                  <td className="py-3 pr-4">
                    {k.samtycke ? (
                      <span className="flex items-center gap-1.5 text-body-md text-on-surface">
                        <Icon
                          name={k.pa_maillista ? "check_circle" : "schedule"}
                          size={17}
                          className={k.pa_maillista ? "text-primary" : "text-on-surface-variant"}
                        />
                        {k.pa_maillista ? "på listan" : "väntar"}
                      </span>
                    ) : (
                      <span className="text-body-md text-on-surface-variant">nej</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="max-w-prose text-body-md text-on-surface-variant">
        Bara den som står som administratör kan öppna den här sidan, och kontrollen sker i
        databasen och inte i webbläsaren. Ett konto utan ja till mejl får fortfarande de mejl som
        handlar om själva kontot, alltså provperiod och betalning.
      </p>
    </div>
  );
}
