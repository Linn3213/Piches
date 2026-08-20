import type { Brand, Deliverable, License, Pitch, Product, Settings } from "@/types/db";
import { CHANNEL_LABEL, FORMAT_LABEL, TERRITORY_LABEL } from "@/types/db";

/**
 * Att ta med sig allt och gå.
 *
 * En kreatör som lagt in ett år av licenser och utgångsdatum måste kunna få ut
 * dem igen, annars är verktyget en fälla och det är en helt rimlig invändning
 * innan hon betalar. Ett verktyg som håller kvar sitt folk för att materialet
 * sitter fast har inte förtjänat att de stannar.
 *
 * Två format med olika syfte. JSON är hela innehållet, exakt som det ligger,
 * så att ingenting går förlorat och en flytt är möjlig. CSV är licenserna med
 * sina datum, för det är den listan man faktiskt vill ha i ett kalkylark när
 * man sitter med en kund.
 */

export type Underlag = {
  brands: Brand[];
  pitches: Pitch[];
  deliverables: Deliverable[];
  licenses: License[];
  products: Product[];
  settings: Settings | null;
};

/** Ett fält i en CSV. Semikolon och citattecken hanteras, inte bara kommatecken. */
export function csvFalt(varde: unknown): string {
  if (varde === null || varde === undefined) return "";
  const s = String(varde);
  // Svensk Excel delar på semikolon, så det är avgränsaren nedan. Innehåller
  // texten semikolon, citattecken eller radbrytning måste fältet omslutas,
  // annars glider hela raden ett steg och kolumnerna blir fel utan att det
  // syns. En anteckning med ett radbyte i räcker för att förstöra filen.
  if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function tillCsv(rader: Record<string, unknown>[], kolumner: string[]): string {
  const huvud = kolumner.map(csvFalt).join(";");
  const kropp = rader.map((r) => kolumner.map((k) => csvFalt(r[k])).join(";"));
  // BOM först, annars visar svensk Excel å ä ö som frågetecken.
  return "﻿" + [huvud, ...kropp].join("\r\n") + "\r\n";
}

const LICENSKOLUMNER = [
  "Varumärke",
  "Uppdrag",
  "Material",
  "Kanaler",
  "Marknad",
  "Startar",
  "Slutar",
  "Evig",
  "Exklusiv bransch",
  "Exklusivitet till",
  "Råmaterial ingår",
  "Licensavgift",
];

/**
 * Licenserna som ett kalkylark, med rubriker på svenska.
 *
 * Kolumnnamnen är inte databasens namn, eftersom filen ska gå att läsa av en
 * människa som aldrig sett appens insida, till exempel en revisor.
 */
export function licenserSomCsv(underlag: Underlag): string {
  const varumarke = new Map(underlag.brands.map((b) => [b.id, b.name]));
  const uppdrag = new Map(underlag.pitches.map((p) => [p.id, p.subject ?? ""]));
  const material = new Map(underlag.deliverables.map((d) => [d.id, d.title]));

  const rader = underlag.licenses
    .slice()
    .sort((a, b) => (a.ends_on ?? "9999").localeCompare(b.ends_on ?? "9999"))
    .map((l) => ({
      Varumärke: l.brand_id ? (varumarke.get(l.brand_id) ?? "") : "",
      Uppdrag: l.pitch_id ? (uppdrag.get(l.pitch_id) ?? "") : "",
      Material: l.deliverable_id ? (material.get(l.deliverable_id) ?? "") : "Hela uppdraget",
      Kanaler: l.channels.map((c) => CHANNEL_LABEL[c] ?? c).join(", "),
      Marknad: TERRITORY_LABEL[l.territory] ?? l.territory,
      Startar: l.starts_on,
      Slutar: l.perpetual ? "" : (l.ends_on ?? ""),
      Evig: l.perpetual ? "ja" : "nej",
      "Exklusiv bransch": l.exclusive_category ?? "",
      "Exklusivitet till": l.exclusivity_ends_on ?? "",
      "Råmaterial ingår": l.includes_raw_files ? "ja" : "nej",
      Licensavgift: l.fee_sek ?? "",
    }));

  return tillCsv(rader, LICENSKOLUMNER);
}

const UPPDRAGSKOLUMNER = [
  "Varumärke",
  "Uppdrag",
  "Status",
  "Ordervärde",
  "Skickad",
  "Vunnen",
  "Fakturanummer",
  "Fakturerad",
  "Förfaller",
  "Betald",
  "Inköpta kostnader",
  "Nedlagda timmar",
  "Material",
];

export function uppdragSomCsv(underlag: Underlag): string {
  const varumarke = new Map(underlag.brands.map((b) => [b.id, b.name]));

  const rader = underlag.pitches
    .slice()
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .map((p) => ({
      Varumärke: p.brand_id ? (varumarke.get(p.brand_id) ?? "") : "",
      Uppdrag: p.subject ?? "",
      Status: p.status,
      Ordervärde: p.value_sek ?? "",
      Skickad: p.sent_at ? p.sent_at.slice(0, 10) : "",
      Vunnen: p.won_at ? p.won_at.slice(0, 10) : "",
      Fakturanummer: p.invoice_number ?? "",
      Fakturerad: p.invoiced_on ?? "",
      Förfaller: p.due_on ?? "",
      Betald: p.paid_on ?? "",
      "Inköpta kostnader": p.production_cost_sek ?? "",
      "Nedlagda timmar": p.hours_spent ?? "",
      Material: underlag.deliverables
        .filter((d) => d.pitch_id === p.id)
        .map((d) => `${d.quantity} ${FORMAT_LABEL[d.format] ?? d.format}`)
        .join(", "),
    }));

  return tillCsv(rader, UPPDRAGSKOLUMNER);
}

/**
 * Hela innehållet, oförändrat.
 *
 * Ingen sortering och ingen omtolkning, för det här är den fil som ska gå att
 * lita på när något gått fel eller när hon vill flytta någon annanstans.
 */
export function alltSomJson(underlag: Underlag, uttagetGjort: string): string {
  return JSON.stringify(
    {
      format: "piches-export-1",
      uttaget: uttagetGjort,
      varumarken: underlag.brands,
      uppdrag: underlag.pitches,
      material: underlag.deliverables,
      licenser: underlag.licenses,
      produkter: underlag.products,
      installningar: underlag.settings,
    },
    null,
    2,
  );
}

/** Filnamn med datum, så att två uttag inte skriver över varandra. */
export function filnamn(del: string, datum: Date, andelse: string): string {
  const d = `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, "0")}-${String(datum.getDate()).padStart(2, "0")}`;
  return `piches-${del}-${d}.${andelse}`;
}
