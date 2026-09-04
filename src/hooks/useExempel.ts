import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  EXEMPEL_LEVERANSER,
  EXEMPEL_LICENSER,
  EXEMPEL_UPPDRAG,
  EXEMPEL_UPPGIFTER,
  EXEMPEL_VARUMARKEN,
  dagFran,
  stampelFran,
} from "@/lib/exempel";

/**
 * Exempeldata som användaren själv slår på och själv tar bort.
 *
 * Den får ALDRIG smyga in. Raderna är märkta i databasen, de är märkta i
 * gränssnittet varje gång de syns, och de går bort med ett klick. Det är
 * skillnaden mot att skriva påhittade siffror i någons riktiga konto, vilket
 * aldrig är okej.
 */

const NYCKEL = ["exempeldata"];

/** Finns det exempeldata i kontot just nu? */
export function useHarExempel() {
  return useQuery({
    queryKey: NYCKEL,
    queryFn: async (): Promise<boolean> => {
      const { count, error } = await supabase
        .from("piches_brands")
        .select("id", { count: "exact", head: true })
        .eq("is_example", true);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
    staleTime: 30_000,
  });
}

/** Allt som ritas om när exemplen kommer eller går. */
function ritaOm(qc: ReturnType<typeof useQueryClient>) {
  for (const n of [
    "brands",
    "pitches",
    "deliverables",
    "licenses",
    "tasks",
    "stats",
    "activities",
    "expiry-radar",
    "exempeldata",
  ]) {
    qc.invalidateQueries({ queryKey: [n] });
  }
}

export function useFyllMedExempel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user.id;
      if (!uid) throw new Error("Du behöver vara inloggad.");

      const idag = new Date();

      // 1. Varumärkena. Id:na behövs för allt annat, så de skrivs först och
      //    läses tillbaka i stället för att gissas.
      const { data: varumarken, error: varumarkesFel } = await supabase
        .from("piches_brands")
        .insert(
          EXEMPEL_VARUMARKEN.map((v) => ({
            user_id: uid,
            name: v.name,
            contact_name: v.contact_name,
            contact_email: v.contact_email,
            tier: v.tier,
            status: v.status,
            observation: v.observation,
            instagram: v.instagram,
            is_example: true,
          })),
        )
        .select("id, name");
      if (varumarkesFel) throw varumarkesFel;

      const varumarkesId = new Map(
        EXEMPEL_VARUMARKEN.map((v) => [
          v.nyckel,
          varumarken?.find((r) => r.name === v.name)?.id as string,
        ]),
      );

      // 2. Uppdragen.
      const { data: uppdrag, error: uppdragsFel } = await supabase
        .from("piches_pitches")
        .insert(
          EXEMPEL_UPPDRAG.map((u) => ({
            user_id: uid,
            brand_id: varumarkesId.get(u.varumarke),
            status: u.status,
            subject: u.subject,
            value_sek: u.value_sek,
            sent_at: stampelFran(idag, -u.skickatFor),
            won_at: u.vunnetFor !== undefined ? stampelFran(idag, -u.vunnetFor) : null,
            invoice_number: u.fakturanummer ?? null,
            invoiced_on: u.fakturaFor !== undefined ? dagFran(idag, -u.fakturaFor) : null,
            due_on: u.forfallerOm !== undefined ? dagFran(idag, u.forfallerOm) : null,
            paid_on: u.betaldFor !== undefined ? dagFran(idag, -u.betaldFor) : null,
            production_cost_sek: u.kostnad ?? null,
            hours_spent: u.timmar ?? null,
            revision_rounds: u.revideringar ?? 0,
            is_example: true,
          })),
        )
        .select("id, subject");
      if (uppdragsFel) throw uppdragsFel;

      const uppdragsId = new Map(
        EXEMPEL_UPPDRAG.map((u) => [
          u.nyckel,
          uppdrag?.find((r) => r.subject === u.subject)?.id as string,
        ]),
      );
      const varumarkeForUppdrag = new Map(
        EXEMPEL_UPPDRAG.map((u) => [u.nyckel, varumarkesId.get(u.varumarke)]),
      );

      // 3. Leveranserna. delivered_at sätts EFTERÅT, i ett eget steg, eftersom
      //    triggern som startar licensklockan bara reagerar på en ändring och
      //    då hade skrivit över licensernas datum med dagens.
      const { data: leveranser, error: leveransFel } = await supabase
        .from("piches_deliverables")
        .insert(
          EXEMPEL_LEVERANSER.map((l) => ({
            user_id: uid,
            pitch_id: uppdragsId.get(l.uppdrag),
            brand_id: varumarkeForUppdrag.get(l.uppdrag),
            title: l.title,
            format: l.format,
            quantity: l.quantity,
            delivered_at: l.levereratFor !== undefined ? stampelFran(idag, -l.levereratFor) : null,
            is_example: true,
          })),
        )
        .select("id, title");
      if (leveransFel) throw leveransFel;
      void leveranser;

      // 4. Licenserna.
      const { error: licensFel } = await supabase.from("piches_licenses").insert(
        EXEMPEL_LICENSER.map((l) => ({
          user_id: uid,
          pitch_id: uppdragsId.get(l.uppdrag),
          brand_id: varumarkeForUppdrag.get(l.uppdrag),
          deliverable_id: null,
          channels: l.channels,
          territory: l.territory,
          starts_on: dagFran(idag, -l.startadeFor),
          ends_on: dagFran(idag, l.slutarOm),
          perpetual: false,
          exclusive_category: l.exclusive_category ?? null,
          exclusivity_ends_on: l.exclusive_category ? dagFran(idag, l.slutarOm) : null,
          includes_raw_files: false,
          fee_sek: l.fee_sek,
          is_example: true,
        })),
      );
      if (licensFel) throw licensFel;

      // 5. Uppgifterna.
      const { error: uppgiftsFel } = await supabase.from("piches_tasks").insert(
        EXEMPEL_UPPGIFTER.map((u) => ({
          user_id: uid,
          brand_id: varumarkesId.get(u.varumarke),
          title: u.title,
          due_at: stampelFran(idag, u.forfallerOm),
          is_example: true,
        })),
      );
      if (uppgiftsFel) throw uppgiftsFel;
    },
    onSuccess: () => ritaOm(qc),
  });
}

export function useTaBortExempel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // Ordningen är den omvända mot skapandet, så att inget hänger kvar och
      // pekar på något raderat. RLS ser till att bara egna rader kan träffas.
      for (const tabell of [
        "piches_tasks",
        "piches_licenses",
        "piches_deliverables",
        "piches_pitches",
        "piches_brands",
      ]) {
        const { error } = await supabase.from(tabell).delete().eq("is_example", true);
        if (error) throw error;
      }
    },
    onSuccess: () => ritaOm(qc),
  });
}
