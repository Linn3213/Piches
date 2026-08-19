import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const kalla = (fil: string) =>
  readFileSync(path.resolve(process.cwd(), fil), "utf8").replace(/\r\n/g, "\n");

/**
 * Regler som inte går att uttrycka som en ren funktion, men som ändå kostar
 * kunder när de bryts.
 *
 * Provperioden gick under en period inte att starta alls mellan midnatt och
 * klockan två på natten. Klienten räknade ut slutdatumet med webbläsarens
 * lokala klocka och RLS jämförde mot serverns current_date, som är UTC, så
 * mellan dygnsbytena var datumet en dag för långt fram och registreringen
 * svarade 403. Ingen grind fångade det: bygget, typerna och alla tester var
 * gröna dygnet runt, eftersom felet bara fanns i mötet mellan två klockor.
 *
 * Testerna nedan bevakar den gränsen i källkoden, för det är det enda stället
 * där den syns.
 */
describe("Abonnemangets invarianter", () => {
  const hook = kalla("src/hooks/useSubscription.ts");

  it("laten klienten aldrig satta provperiodens slutdatum", () => {
    // Databasen har default (current_date + 14) och RLS mater mot samma klocka.
    // Skickar klienten med ett eget datum ar de tva klockorna tillbaka.
    expect(hook).not.toContain("trial_ends_on:");
  });

  it("skickar aldrig status eller Stripe-falt som bara servern far satta", () => {
    // En insert med status aktiv skulle ge gratis tillgang for evigt om RLS
    // nagon gang luckras upp. Klienten ska inte ens forsoka.
    const insertBlock = hook.slice(hook.indexOf(".insert("), hook.indexOf(".select()"));
    expect(insertBlock).toContain('status: "provperiod"');
    expect(insertBlock).not.toContain("granted_by_owner");
    expect(insertBlock).not.toContain("stripe_");
    expect(insertBlock).not.toContain("current_period_end");
  });

  it("namnger serverns fel i stallet for att svalja det", () => {
    // Ett tyst "forsok igen" har betyder att nagon som VILL betala inte kan,
    // och det syns aldrig i nagon statistik.
    expect(hook).toContain("svar.error");
  });

  it("faller tillbaka pa lagrad status nar Stripe inte svarar", () => {
    // Att lasa ute en betalande kund for ett natverksfel kostar mer an nagra
    // extra dagar at nagon som sagt upp sig.
    const synk = hook.slice(hook.indexOf("behoverStripeSynk(rad"));
    expect(synk).toContain("return rad");
  });
});
