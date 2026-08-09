import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";

/**
 * TRE LAGER, EN KODBAS.
 *
 *   npm run build              → dist/                 (STANDALONE, Piches egen look)
 *   npm run build:essensia     → dist-essensia/        (skogsgrönt PÅLAGT skin)
 *   npm run build:linnartistry → dist-linnartistry/    (cream/espresso PÅLAGT skin)
 *
 * Standalone är default. Pluginet sätter data-brand på <html> och laddar bara
 * det pålagda husets typsnitt — standalone laddar ingen extra font och ser ut
 * exakt som förut. Färgerna följer av lagren i src/index.css.
 */

const FONT_HREF: Record<string, string> = {
  essensia:
    "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=DM+Sans:wght@400;500;600;700&display=swap",
  linnartistry:
    "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Quicksand:wght@300;400;500;600;700&display=swap",
};

/**
 * Adressfältet på mobilen målas i theme-color, alltså utanför den CSS som
 * husen byter färg med. index.html har standalone-värdet inbakat, så utan den
 * här omskrivningen får båda husen Piches off-white i överkant medan resten av
 * skärmen är linne respektive cream. Värdena ska vara samma som --c-background
 * för respektive hus i src/index.css.
 */
const THEME_COLOR: Record<string, string> = {
  essensia: "#f6f1e9",
  linnartistry: "#eae1d7",
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const raw = env.VITE_BRAND ?? process.env.VITE_BRAND ?? "standalone";
  const brand = raw === "essensia" || raw === "linnartistry" ? raw : "standalone";

  // Husen bor i en underkatalog (app.essensiadesign.se/piches/). Standalone
  // ligger kvar på sin egen domänrot.
  const rawBase = env.VITE_BASE_PATH ?? "/";
  const basePath = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

  return {
    base: basePath,
    plugins: [
      react(),
      {
        name: "piches-brand-html",
        transformIndexHtml(html: string) {
          let out = html.replace(/<html(?![^>]*data-brand)([^>]*)>/, `<html$1 data-brand="${brand}">`);
          if (brand !== "standalone") {
            // index.html har redan preconnect till gstatic, så bara stilmallen
            // behöver läggas till här.
            out = out.replace(
              "</head>",
              `    <link rel="stylesheet" href="${FONT_HREF[brand]}" />\n  </head>`,
            );
            out = out.replace(
              /<meta\s+name="theme-color"\s+content="[^"]*"\s*\/?>/,
              `<meta name="theme-color" content="${THEME_COLOR[brand]}" />`,
            );
          }
          return out;
        },
      },
      {
        // Piches använder riktiga adresser, inte hash. Utan en fallback svarar
        // webbservern 404 när någon laddar om på en undersida. Repot har redan
        // en .htaccess för standalone-roten; den här skrivs för husens
        // underkatalog, där RewriteBase måste peka rätt.
        //
        // VIKTIGT: Vite kopierar public/ till outDir INNAN Rollup skriver
        // bundlen, så den här filen skriver över public/.htaccess i husbygget.
        // Därför måste hela regeluppsättningen upprepas här. Tas något bort
        // nedan försvinner det tyst ur husens deploy medan standalone behåller
        // det, och det syns inte på sajten. Ändras public/.htaccess ska den
        // här följa med.
        name: "piches-spa-fallback",
        apply: "build" as const,
        generateBundle(this: {
          emitFile: (f: { type: "asset"; fileName: string; source: string }) => void;
        }) {
          if (basePath === "/") return; // standalone har sin egen, rör den inte
          this.emitFile({
            type: "asset",
            fileName: ".htaccess",
            source: [
              "# Piches i en underkatalog. Samma regler som public/.htaccess,",
              `# men med RewriteBase ${basePath} i stället för /.`,
              "",
              "# Hostinger lägger en default.php i varje ny mapp. Den ska aldrig",
              "# kunna vinna över appen.",
              "DirectoryIndex index.html",
              "",
              "<IfModule mod_rewrite.c>",
              "  RewriteEngine On",
              `  RewriteBase ${basePath}`,
              "",
              "  # Riktiga filer och mappar serveras som vanligt.",
              "  RewriteCond %{REQUEST_FILENAME} -f [OR]",
              "  RewriteCond %{REQUEST_FILENAME} -d",
              "  RewriteRule ^ - [L]",
              "",
              "  # Allt annat är en väg inuti appen.",
              `  RewriteRule . ${basePath}index.html [L]`,
              "</IfModule>",
              "",
              "# index.html får aldrig cachas. Filnamnen på js och css innehåller en",
              "# hash och byts vid varje bygge, men det hjälper inte om webbläsaren",
              "# sitter kvar på en gammal index.html som pekar på filer som inte",
              "# finns längre.",
              "<IfModule mod_headers.c>",
              '  <FilesMatch "index\\.html$">',
              '    Header set Cache-Control "no-cache, no-store, must-revalidate"',
              '    Header set Pragma "no-cache"',
              '    Header set Expires "0"',
              "  </FilesMatch>",
              "",
              "  # Hashade filer kan däremot cachas hårt, eftersom ett nytt innehåll",
              "  # alltid betyder ett nytt filnamn.",
              '  <FilesMatch "\\.(js|css|woff2?|ttf|otf|eot|svg|png|jpe?g|webp|avif|ico)$">',
              '    Header set Cache-Control "public, max-age=31536000, immutable"',
              "  </FilesMatch>",
              "",
              '  Header set X-Content-Type-Options "nosniff"',
              '  Header set Referrer-Policy "strict-origin-when-cross-origin"',
              '  Header always set X-Frame-Options "SAMEORIGIN"',
              '  Header always set Strict-Transport-Security "max-age=31536000"',
              '  Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()"',
              '  Header always set X-Robots-Tag "noindex, nofollow, noarchive"',
              "</IfModule>",
              "",
              "<IfModule mod_deflate.c>",
              "  AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json image/svg+xml",
              "</IfModule>",
              "",
              "# Serverns egen kataloglistning ska aldrig visas.",
              "Options -Indexes",
              "",
            ].join("\n"),
          });
        },
      },
    ],
    define: {
      "import.meta.env.VITE_BRAND": JSON.stringify(brand),
    },
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
    build: {
      outDir: brand === "standalone" ? "dist" : `dist-${brand}`,
    },
    server: { port: 5180 },
  };
});
