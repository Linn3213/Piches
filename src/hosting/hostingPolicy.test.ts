import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const rootFile = (file: string) =>
  readFileSync(path.resolve(process.cwd(), file), "utf8").replace(/\r\n/g, "\n");

/**
 * Indexeringspolicyn ändrades den dag Piches fick en landningssida.
 *
 * Tidigare blockerades ALLT, vilket var rätt så länge hela adressen bara var
 * en inloggningsruta. Nu är roten produktens skyltfönster och måste gå att
 * hitta, samtidigt som appen bakom inloggningen fortfarande inte har något i
 * ett sökindex att göra.
 *
 * Testerna nedan finns för att den gränsen går att flytta av misstag på tre
 * olika ställen som alla ser oskyldiga ut var för sig: en HTTP-rubrik i
 * .htaccess, en meta-tagg i index.html och en rad i robots.txt. Rubriken
 * vinner över de andra två, så en kvarglömd rad där gör hela landningssidan
 * osynlig utan att något syns i koden.
 */

const sakerhetsheaders = [
  'Header always set Strict-Transport-Security "max-age=31536000"',
  'Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()"',
];

describe("Piches indexeringspolicy", () => {
  it("slapper in sokmotorer pa standalone, dar produkten saljs", () => {
    expect(rootFile("index.html")).toContain('<meta name="robots" content="index, follow" />');
  });

  it("har INGEN X-Robots-Tag pa standalone, for rubriken slar ut allt annat", () => {
    // Raden satt har tidigare och gjorde bade meta-taggen och robots.txt
    // verkningslosa. Kommer den tillbaka blir landningssidan omojlig att hitta
    // utan att nagot annat i koden ser fel ut.
    const rader = rootFile("public/.htaccess")
      .split("\n")
      .filter((r) => !r.trim().startsWith("#"));
    expect(rader.join("\n")).not.toContain("X-Robots-Tag");
  });

  it("haller husbyggena utanfor sokindex, de ar privata installationer", () => {
    // Essensia och LinnArtistry ar palagda skin pa en kunds egen adress. Bade
    // meta-taggen och rubriken byts av vite-pluginet.
    const vite = rootFile("vite.config.ts");
    expect(vite).toContain('Header always set X-Robots-Tag "noindex, nofollow, noarchive"');
    expect(vite).toContain('<meta name="robots" content="noindex, nofollow, noarchive" />');
  });

  it("slapper bara in crawlern pa de tva sidor som gar att lasa utan konto", () => {
    const robots = rootFile("public/robots.txt");
    expect(robots).toContain("Allow: /$");
    expect(robots).toContain("Allow: /logga-in");
    // Varje inloggad vy ska vara utestangd. Missas en har hamnar en tom
    // app-skarm i Googles index i stallet for saljsidan.
    for (const vy of [
      "/uppdrag",
      "/rattigheter",
      "/pris",
      "/intakter",
      "/lonsamhet",
      "/varumarken",
      "/uppgifter",
      "/installningar",
      "/konto",
    ]) {
      expect(robots).toContain(`Disallow: ${vy}`);
    }
    expect(robots).toContain("Sitemap: https://piches.essensiadesign.se/sitemap.xml");
  });

  it("har en sitemap med de publika sidorna och ingen SPA-fallback", () => {
    const sitemap = rootFile("public/sitemap.xml");
    expect(sitemap).toContain("<urlset");
    expect(sitemap).toContain("<loc>https://piches.essensiadesign.se/</loc>");
    expect(sitemap).toContain("<loc>https://piches.essensiadesign.se/logga-in</loc>");
    // Ingen inloggad vy far ligga i sitemapen.
    expect(sitemap).not.toContain("/uppdrag");
    expect(sitemap).not.toContain("/konto");
    expect(sitemap).not.toContain('<div id="root">');
  });

  it("beskriver produkten i title och beskrivning, inte bara namnet", () => {
    // "Piches" som ensam titel sager ingenting for nagon som soker pa det
    // problem appen loser, och det ar de sokningarna som ger kunder.
    const html = rootFile("index.html");
    expect(html).toMatch(/<title>[^<]*licens/i);
    expect(html).toContain('<link rel="canonical" href="https://piches.essensiadesign.se/" />');
    // Attributen matchas var for sig, eftersom flera av taggarna ar radbrutna
    // over tre rader for att texterna ar langa.
    expect(html).toContain('property="og:title"');
    expect(html).toContain('property="og:description"');
    expect(html).toContain('name="twitter:card"');
  });
});

describe("Piches sakerhetsheaders", () => {
  it.each(sakerhetsheaders)("finns i standalone: %s", (header) => {
    expect(rootFile("public/.htaccess")).toContain(header);
  });

  it.each(sakerhetsheaders)("speglas i undermappsbyggen: %s", (header) => {
    expect(rootFile("vite.config.ts")).toContain(header);
  });
});
