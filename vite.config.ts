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
            out = out.replace(
              "</head>",
              `    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n` +
                `    <link rel="stylesheet" href="${FONT_HREF[brand]}" />\n  </head>`,
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
              "# Hostinger lägger en default.php i varje ny mapp. Den ska aldrig",
              "# kunna vinna över appen. Samma skäl som i public/.htaccess.",
              "DirectoryIndex index.html",
              "",
              "<IfModule mod_rewrite.c>",
              "  RewriteEngine On",
              `  RewriteBase ${basePath}`,
              "  RewriteCond %{REQUEST_FILENAME} -f [OR]",
              "  RewriteCond %{REQUEST_FILENAME} -d",
              "  RewriteRule ^ - [L]",
              `  RewriteRule . ${basePath}index.html [L]`,
              "</IfModule>",
              "",
              '<FilesMatch "index\\.html$">',
              "  <IfModule mod_headers.c>",
              '    Header set Cache-Control "no-cache, must-revalidate"',
              "  </IfModule>",
              "</FilesMatch>",
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
