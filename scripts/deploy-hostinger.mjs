#!/usr/bin/env node
/**
 * DEPLOY, HELT GENOM CLAUDE CODE. Ingen Cowork, ingen manuell hPanel-runda.
 *
 *   npm run deploy                  → target "standalone" ur deploy.config.json
 *   npm run deploy -- kund          → target "kund"
 *   npm run deploy -- kund --no-build
 *   npm run deploy -- kund --dry-run
 *
 * Vägen är alltid: bygg lokalt → zippa → ladda upp till Hostinger → utlös
 * uppackning → verifiera att RÄTT bygge faktiskt ligger live, inte bara att
 * sidan svarar 200. Ett grönt bygge bevisar ingenting i sig, se CLAUDE.md.
 *
 * Protokollet är återskapat genom att läsa Hostingers egen MCP-server
 * (hostinger-api-mcp), inte gissat fram. Tre steg som alla krävs:
 *   1. POST  /api/hosting/v1/files/upload-urls           → korta engångsuppgifter
 *   2. En "väck upp filen"-POST till uppladdningsadressen, sedan en riktig
 *      TUS-uppladdning (tus-js-client) av samma fil. Hoppa över steg 1 av de
 *      två och uppladdningen svarar 400 "invalid upload offset".
 *   3. POST .../websites/{domain}/deploy  { archive_path }  → packar upp servern
 *
 * Alla tre görs direkt härifrån med fetch(), ingen mellanhand behövs. En
 * gammal HOSTINGER_API_TOKEN i Windows-användarens miljövariabler såg
 * tidigare ut som ett nätverksproblem (401 på kontoanrop, 200 på
 * uppladdning) men var bara en skuggad, ogiltig token. Se
 * scripts/hostinger-token.ps1 för hur den rätta hämtas.
 */

import { execFileSync } from "node:child_process";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import archiver from "archiver";
import * as tus from "tus-js-client";

const ROT = process.cwd();
const API = "https://developers.hostinger.com/api";

// --- CLI ---------------------------------------------------------------------

const argv = process.argv.slice(2);
const flaggor = new Set(argv.filter((a) => a.startsWith("--")));
const targetNamn = argv.find((a) => !a.startsWith("--")) ?? "standalone";
const utanBygge = flaggor.has("--no-build");
const provkorning = flaggor.has("--dry-run");

function fel(text) {
  console.error(`\n✗ ${text}\n`);
  process.exit(1);
}

// --- Konfiguration -------------------------------------------------------------

const cfgPath = join(ROT, "deploy.config.json");
if (!existsSync(cfgPath)) {
  fel(
    `deploy.config.json saknas. Kopiera deploy.config.example.json till deploy.config.json och fyll i domänen.`,
  );
}
const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
const target = cfg.targets?.[targetNamn];
if (!target) {
  fel(
    `Ingen target "${targetNamn}" i deploy.config.json. Tillgängliga: ${Object.keys(cfg.targets ?? {}).join(", ") || "(inga)"}`,
  );
}
const { domain, dist, build, path: undermapp } = target;
// Kontots användarnamn är stabilt per Hostinger-konto och slås medvetet inte
// upp via API:et (den slutpunkten är en av dem som svarar 401 härifrån, se
// motiveringen ovan). Sätt "username" i deploy.config.json en gång, det
// gäller sedan alla targets på samma konto.
const username = target.username ?? cfg.username;
if (!domain || !dist) fel(`Target "${targetNamn}" saknar domain eller dist i deploy.config.json.`);
if (!username) fel(`Inget "username" satt, varken på target "${targetNamn}" eller på toppnivå i deploy.config.json.`);

console.log(`\nDEPLOY  ${targetNamn}  →  ${domain}${undermapp ? `/${undermapp}/` : "/"}\n`);

// --- 1. Bygg -------------------------------------------------------------------

if (!utanBygge) {
  const kommando = build ?? "build";
  console.log(`▸ npm run ${kommando}`);
  try {
    execFileSync("npm", ["run", kommando], { stdio: "inherit", cwd: ROT, shell: true });
  } catch {
    fel(`Bygget misslyckades (npm run ${kommando}). Inget laddas upp.`);
  }
} else {
  console.log("▸ Bygge hoppat över (--no-build), använder befintlig", dist);
}

const distPath = join(ROT, dist);
if (!existsSync(join(distPath, "index.html"))) {
  fel(`${dist}/index.html saknas efter bygget. Kontrollera att build-kommandot faktiskt skriver dit.`);
}

// --- 2. Frysstämpel för att bevisa att RÄTT bygge går live ---------------------
//
// Ett 200-svar bevisar bara att servern svarar, inte att det är den nya
// koden. En cirkulär chunk-kedja gav tidigare grönt bygge, korrekt hash och
// ändå en helvit sida. Stämpeln knyter verifieringen till just det här bygget.

const stampel = `${targetNamn}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
writeFileSync(join(distPath, ".deploy-id"), stampel);
console.log(`▸ Byggstämpel: ${stampel}`);

if (provkorning) {
  console.log("\n▸ --dry-run: byggt och stämplat, men laddar inte upp. Klart.\n");
  process.exit(0);
}

// --- 3. Hämta token --------------------------------------------------------

// Valvet vinner ALLTID över miljövariabeln när det finns. En gammal, ogiltig
// HOSTINGER_API_TOKEN i Windows-användarmiljön har redan en gång kostat en
// hel felsökningsrunda som såg ut som ett nätverksproblem (401 på
// kontoanrop, 200 på uppladdning), när det bara var en skuggad token. Windows
// cachar dessutom User-miljövariabler per process, så även SEDAN den rättats
// i registret fortsätter en redan startad terminal att skicka den gamla tills
// den startas om, det är alltså inte nog att bara sätta rätt värde en gång.
function hamtaToken() {
  // fileURLToPath, inte .pathname: sökvägen är URL-kodad, så en mapp med
  // mellanslag ("Planexr v Essensia") blev "Planexr%20v%20Essensia" och pwsh
  // svarade "is not recognized as the name of a script file". Deployen föll då
  // tyst tillbaka på miljövariabeln, vilket fungerar tills den variabeln är
  // den gamla skuggade token, och då blir felet ett obegripligt 401.
  const skriptPath = fileURLToPath(new URL("./hostinger-token.ps1", import.meta.url));
  try {
    const frånValvet = execFileSync("pwsh", ["-NoProfile", "-File", skriptPath], {
      encoding: "utf8",
      env: { ...process.env, HOSTINGER_API_TOKEN: "" }, // tvinga fram valvet, ignorera ev. skuggning
    }).trim();
    if (frånValvet) return frånValvet;
  } catch {
    // inget valv på den här maskinen, fall igenom till miljövariabeln
  }
  if (process.env.HOSTINGER_API_TOKEN) return process.env.HOSTINGER_API_TOKEN;
  fel(
    "Ingen Hostinger-token hittad. Sätt miljövariabeln HOSTINGER_API_TOKEN, eller kör på en maskin med DPAPI-valvet.",
  );
}
const token = hamtaToken();
const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
console.log(`▸ Konto: ${username}`);

// Snabb självkoll innan bygget laddas upp i onödan: fel token ger annars ett
// kryptiskt 401 mitt i uppladdningen. Hellre stoppa här, med rätt diagnos.
{
  const kollR = await fetch(`${API}/hosting/v1/websites?domain=${encodeURIComponent(domain)}&per_page=1`, {
    headers: auth,
  });
  if (kollR.status === 401) {
    fel(
      `Hostinger avvisade token (401). Om HOSTINGER_API_TOKEN är satt som miljövariabel i det här terminalfönstret: ` +
        `den kan vara skuggad/inaktuell, öppna ett nytt terminalfönster eller unset HOSTINGER_API_TOKEN och kör igen.`,
    );
  }
}

// --- 5. Ladda upp en fil till Hostingers TUS-gateway ---------------------------
//
// Två steg krävs, i den ordningen: en vanlig POST som "väcker" filen på
// servern, sedan en riktig TUS-uppladdning av samma innehåll. Ett enda PATCH
// utan den första POST:en svarar 400 "invalid upload offset".

async function ladda_upp(uppladdningsuppgifter, lokalSokvag, malSokvag) {
  const { url, auth_key, rest_auth_key } = uppladdningsuppgifter;
  const rensadUrl = url.replace(/\/$/, "");
  const fullUrl = `${rensadUrl}/${malSokvag}?override=true`;
  const stats = statSync(lokalSokvag);

  const vack = await fetch(fullUrl, {
    method: "POST",
    headers: {
      "X-Auth": auth_key,
      "X-Auth-Rest": rest_auth_key,
      "upload-length": String(stats.size),
      "upload-offset": "0",
    },
  });
  if (vack.status !== 201) {
    throw new Error(`Väckningen av ${malSokvag} svarade ${vack.status}, väntade 201.`);
  }

  await new Promise((resolve, reject) => {
    const upload = new tus.Upload(createReadStream(lokalSokvag), {
      uploadUrl: fullUrl,
      retryDelays: [1000, 2000, 4000, 8000],
      uploadDataDuringCreation: false,
      parallelUploads: 1,
      chunkSize: 10_485_760,
      headers: { "X-Auth": auth_key, "X-Auth-Rest": rest_auth_key },
      removeFingerprintOnSuccess: true,
      uploadSize: stats.size,
      metadata: { filename: malSokvag.split("/").pop() },
      onError: reject,
      onSuccess: () => resolve(),
    });
    upload.start();
  });
}

async function hamtaUppladdningsuppgifter() {
  const r = await fetch(`${API}/hosting/v1/files/upload-urls`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ username, domain }),
  });
  if (!r.ok) fel(`Kunde inte hämta uppladdningsuppgifter (status ${r.status}).`);
  return r.json();
}

// --- 6a. Rotläge: hela domänen, en zip, en uppackning --------------------------

async function zippaKatalog(katalog) {
  const tempDir = mkdtempSync(join(tmpdir(), "app-mall-deploy-"));
  const zipPath = join(tempDir, "bygge.zip");
  await new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const arkiv = archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolve);
    arkiv.on("error", reject);
    arkiv.pipe(output);
    arkiv.directory(katalog, false);
    arkiv.finalize();
  });
  return { zipPath, tempDir };
}

async function deployRot() {
  const { zipPath, tempDir } = await zippaKatalog(distPath);
  console.log(`▸ Zippat: ${(statSync(zipPath).size / 1024).toFixed(0)} kB`);

  try {
    console.log("▸ Laddar upp");
    const uppgifter = await hamtaUppladdningsuppgifter();
    await ladda_upp(uppgifter, zipPath, "bygge.zip");

    console.log("▸ Packar upp på servern");
    const r = await fetch(`${API}/hosting/v1/accounts/${username}/websites/${domain}/deploy`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ archive_path: "bygge.zip" }),
    });
    if (!r.ok) fel(`Uppackningen misslyckades (status ${r.status}): ${await r.text()}`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

// --- 6b. Undermappsläge: filträdet laddas upp direkt, ingen serverpackning -----
//
// Deploy-slutpunkten packar alltid upp i domänens rot. En app som bor i en
// undermapp (kund.se/appen/) kan inte gå den vägen, filerna läggs i stället
// på sina slutgiltiga sökvägar direkt via TUS-gatewayen.

async function allaFiler(katalog, bas = katalog) {
  const poster = await readdir(katalog, { withFileTypes: true });
  const ut = [];
  for (const p of poster) {
    const full = join(katalog, p.name);
    if (p.isDirectory()) {
      /* Rekursionen returnerar REDAN färdiga { full, rel }-poster. Tidigare
         slogs de ihop med råa sökvägar och hela listan mappades om på slutet,
         så relative() fick ett objekt i stället för en sträng så fort dist
         innehöll en undermapp. Och ett Vite-bygge har ALLTID assets/.
         Följden: undermappsdeployen kraschade varje gång, Piches låg kvar med
         ett gammalt rotbygge på essensiadesign.se/piches/ och renderade vit
         sida eftersom den hämtade sina filer från fel sökväg. */
      ut.push(...(await allaFiler(full, bas)));
    } else {
      ut.push({ full, rel: relative(bas, full).split(sep).join("/") });
    }
  }
  return ut;
}

async function deployUndermapp() {
  const filer = await allaFiler(distPath);
  console.log(`▸ Laddar upp ${filer.length} filer till /${undermapp}/`);
  const uppgifter = await hamtaUppladdningsuppgifter();

  let klara = 0;
  for (const f of filer) {
    await ladda_upp(uppgifter, f.full, `${undermapp}/${f.rel}`);
    klara++;
    if (klara % 10 === 0 || klara === filer.length) {
      process.stdout.write(`\r  ${klara}/${filer.length}`);
    }
  }
  process.stdout.write("\n");
}

if (undermapp) {
  await deployUndermapp();
} else {
  await deployRot();
}

// --- 7. Verifiera att RÄTT bygge faktiskt är live ------------------------------

const basAdress = `https://${domain}${undermapp ? `/${undermapp}` : ""}`;

console.log("▸ Verifierar");
await new Promise((r) => setTimeout(r, 3000));

async function hamtaMedRetry(url, forsok = 5) {
  for (let i = 0; i < forsok; i++) {
    const r = await fetch(url, { cache: "no-store" });
    if (r.ok) return r;
    await new Promise((res) => setTimeout(res, 2000));
  }
  return null;
}

const sida = await hamtaMedRetry(`${basAdress}/`);
if (!sida) fel(`${basAdress}/ svarar inte efter uppladdningen. Kontrollera manuellt innan du litar på deployen.`);

const stampelSvar = await hamtaMedRetry(`${basAdress}/.deploy-id`);
const liveStampel = stampelSvar ? (await stampelSvar.text()).trim() : null;

if (liveStampel === stampel) {
  console.log(`\n✓ Live och verifierat: ${basAdress}/  (stämpel ${stampel})\n`);
} else {
  fel(
    `${basAdress}/ svarar, men stämpeln stämmer inte (väntade "${stampel}", fick "${liveStampel ?? "ingen"}"). ` +
      `Troligen cache mellan CDN och server, ladda om om en stund och jämför manuellt innan du litar på deployen.`,
  );
}
