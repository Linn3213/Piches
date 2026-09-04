import { useHarExempel, useTaBortExempel } from "@/hooks/useExempel";
import { Icon } from "@/components/ui";

/**
 * Så länge exempeldata ligger kvar ska det stå på varenda sida.
 *
 * Regeln bakom: påhittade siffror i någons riktiga konto är aldrig okej. Det
 * enda som gör exemplen försvarbara är att hon slog på dem själv, att det står
 * överallt att de är exempel, och att de går bort med ett klick. Tas någon av
 * de tre bort är det inte längre exempeldata utan lögn i hennes bokföring.
 */
export function ExempelBanderoll() {
  const { data: harExempel } = useHarExempel();
  const taBort = useTaBortExempel();

  if (!harExempel) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-tertiary/40 bg-tertiary-container px-4 py-3">
      <div className="flex items-center gap-2.5 text-on-tertiary-container">
        <Icon name="science" size={20} className="shrink-0" />
        <p className="text-body-md">
          Det här är exempeldata, inte dina riktiga uppdrag. Siffrorna är påhittade.
        </p>
      </div>
      <button
        onClick={() => taBort.mutate()}
        disabled={taBort.isPending}
        className="rounded-full border border-on-tertiary-container/30 px-4 py-1.5 text-label-caps uppercase text-on-tertiary-container transition-colors hover:bg-on-tertiary-container/10 disabled:opacity-60"
      >
        {taBort.isPending ? "Tar bort..." : "Ta bort exemplen"}
      </button>
      {taBort.isError && (
        <p className="w-full text-body-md text-error" role="alert">
          Det gick inte att ta bort exemplen. Ladda om sidan och försök igen.
        </p>
      )}
    </div>
  );
}
