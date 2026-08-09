import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const rootFile = (file: string) =>
  readFileSync(path.resolve(process.cwd(), file), "utf8").replace(/\r\n/g, "\n");

const requiredHeaders = [
  'Header always set Strict-Transport-Security "max-age=31536000"',
  'Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()"',
  'Header always set X-Robots-Tag "noindex, nofollow, noarchive"',
];

describe("Piches indexeringspolicy", () => {
  it("blockerar all crawling med en riktig robots.txt", () => {
    expect(rootFile("public/robots.txt").trim()).toBe("User-agent: *\nDisallow: /");
  });

  it("levererar ett giltigt tomt sitemap-dokument i stället för SPA-fallback", () => {
    const sitemap = rootFile("public/sitemap.xml");
    expect(sitemap).toContain("<urlset");
    expect(sitemap).not.toContain("<url>");
    expect(sitemap).not.toContain('<div id="root">');
  });

  it("har noindex i rå HTML även utan JavaScript", () => {
    expect(rootFile("index.html")).toContain(
      '<meta name="robots" content="noindex, nofollow, noarchive" />',
    );
  });
});

describe("Piches säkerhetsheaders", () => {
  it.each(requiredHeaders)("finns i standalone: %s", (header) => {
    expect(rootFile("public/.htaccess")).toContain(header);
  });

  it.each(requiredHeaders)("speglas i undermappsbyggen: %s", (header) => {
    expect(rootFile("vite.config.ts")).toContain(header);
  });
});
