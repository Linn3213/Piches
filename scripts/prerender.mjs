#!/usr/bin/env node
/**
 * FÖRRENDERING AV LANDNINGSSIDAN.
 *
 * Mätt före: `curl` mot piches.essensiadesign.se gav 0 tecken läsbar text.
 * Hela sidan byggs av JavaScript, så den råa HTML som en sökmotor eller en
 * AI-assistent hämtar innehåller ingenting alls. Google renderar javascript
 * numera, men långsamt och opålitligt, och de flesta AI-hämtare gör det
 * INTE alls. En produkt som ska hittas via sökning eller rekommenderas av en
 * assistent måste finnas i källkoden.
 *
 * Bara roten förrenderas. Att lägga en mapp per sida ger en omdirigering till
 * adressen med avslutande snedstreck, och varje jämförelse mot `/x` missar då,
 * vilket redan en gång tyst tog ner en inloggning i ett annat av de här
 * projekten. Roten har inte det problemet.
 */
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { extname, join } from "node:path";
import { chromium } from "playwright";

const DIST = join(process.cwd(), "dist");
const PORT = 4319;

const TYPER = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".xml": "application/xml",
  ".txt": "text/plain",
};

const server = createServer((req, res) => {
  const vag = decodeURIComponent((req.url || "/").split("?")[0]);
  let fil = join(DIST, vag === "/" ? "index.html" : vag);
  if (!existsSync(fil) || vag === "/") fil = join(DIST, "index.html");
  try {
    const kropp = readFileSync(fil);
    res.writeHead(200, { "Content-Type": TYPER[extname(fil)] ?? "application/octet-stream" });
    res.end(kropp);
  } catch {
    res.writeHead(404);
    res.end("");
  }
});

await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://localhost:${PORT}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("h1", { timeout: 30000 });
// Bilderna laddas lazy, men markup ska med. Vänta tills sidan står still.
await page.waitForTimeout(2500);

const rotens_innehall = await page.evaluate(() => document.getElementById("root")?.innerHTML ?? "");
await browser.close();
server.close();

if (rotens_innehall.length < 2000) {
  console.error(`✗ Förrenderingen gav bara ${rotens_innehall.length} tecken, det är för lite.`);
  process.exit(1);
}

const indexVag = join(DIST, "index.html");
let html = readFileSync(indexVag, "utf8");

if (!html.includes('<div id="root"></div>')) {
  console.error("✗ Hittade inte den tomma rot-diven i dist/index.html.");
  process.exit(1);
}

html = html.replace('<div id="root"></div>', `<div id="root">${rotens_innehall}</div>`);
writeFileSync(indexVag, html, "utf8");

// Mät utfallet i stället för att lita på att det gick bra.
const lasbart = html
  .replace(/<script[\s\S]*?<\/script>/g, " ")
  .replace(/<style[\s\S]*?<\/style>/g, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
  .trim();

console.log(`✓ Förrenderad: ${rotens_innehall.length} tecken markup, ${lasbart.length} tecken läsbar text utan JavaScript.`);
