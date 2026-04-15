#!/usr/bin/env node
/**
 * Erzeugt die PDF-Renderer-Assets (react-pdf) aus den App-Quellen:
 *
 * 1. Fonts: Variante der Hausschrift "Geist" mit eingefrorenem OpenType-
 *    Feature `tnum` (tabular figures) für die Zahlenspalten in Tabellen.
 *    react-pdf v4 hat keine Style-API für OT-Features, daher wird das
 *    Feature direkt in die Default-Glyphen "eingebacken".
 *    Tool: pyftfeatfreeze (pip install opentype-feature-freezer).
 *    Pflicht-Abhängigkeit: Fehlt das Tool, bricht das Skript mit Fehler ab -
 *    es gibt keinen stillen Fallback, da die tabular-nums-Ausrichtung in den
 *    Abrechnungs-PDFs verbindlich ist.
 *
 * 2. SVG: PDF-taugliche Variante des App-Logos. `@react-pdf/svg` parst keine
 *    modernen CSS-Farb-Funktionen wie `oklch()`; das Original-SVG (Tailwind-
 *    Farben in OKLCH) würde im PDF einfarbig schwarz gerendert. Lösung: Aus
 *    jedem `style="..."` die `fill:oklch(...)`-Deklaration entfernen, sodass
 *    das parallel vorhandene `fill="#xxxxxx"`-Attribut gewinnt - react-pdf
 *    rendert dann mit den HEX-Farben.
 *
 * Idempotent: existierende Output-Dateien werden nicht erneut erzeugt. Bei
 * Font-/Logo-Änderungen Output-Datei löschen und Skript nochmal laufen
 * lassen (`npm run freeze-pdf-assets`).
 */
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(import.meta.url), "..", "..");

const fontSources = [
  {
    src: "node_modules/@fontsource/geist-sans/files/geist-sans-latin-400-normal.woff",
    out: "packages/pdf/assets/fonts/geist-sans-tnum-400-normal.woff",
  },
  {
    src: "node_modules/@fontsource/geist-sans/files/geist-sans-latin-600-normal.woff",
    out: "packages/pdf/assets/fonts/geist-sans-tnum-600-normal.woff",
  },
];

const svgSources = [
  {
    src: "apps/web/src/img/logo/logo.svg",
    out: "packages/pdf/assets/logo-pdf.svg",
  },
];

/**
 * Entfernt `fill:oklch(...)`-Deklarationen aus inline-style-Attributen.
 * Lässt andere style-Properties (z. B. `fill-rule`, `clip-rule`) intakt.
 * Wenn das style-Attribut nach dem Strippen leer ist, wird es ganz entfernt.
 */
const stripOklchFills = (svg) =>
  svg.replace(/style="([^"]*)"/gu, (_match, body) => {
    const cleaned = body
      .replace(/fill\s*:\s*oklch\([^)]*\)\s*;?/giu, "")
      .replace(/;\s*;/gu, ";")
      .replace(/^\s*;\s*/u, "")
      .replace(/\s*;\s*$/u, "")
      .trim();
    return cleaned.length > 0 ? `style="${cleaned}"` : "";
  });

// --- Fonts ---

const haspyftfeatfreeze = (() => {
  const result = spawnSync("pyftfeatfreeze", ["--help"], { stdio: "ignore" });
  return result.status === 0;
})();

if (!haspyftfeatfreeze) {
  console.error(
    "[freeze-pdf-fonts] FEHLER: pyftfeatfreeze nicht gefunden. Die",
    "tabular-nums-Schrift für die Abrechnungs-PDFs kann nicht erzeugt werden.",
  );
  console.error(
    "[freeze-pdf-fonts] Installieren mit:",
    "  pip install opentype-feature-freezer",
    "  npm run freeze-pdf-assets",
  );
  process.exit(1);
}

let generatedFonts = 0;
for (const { src, out } of fontSources) {
  const srcAbs = resolve(repoRoot, src);
  const outAbs = resolve(repoRoot, out);
  if (!existsSync(srcAbs)) {
    console.error(`[freeze-pdf-fonts] FEHLER: Source nicht gefunden: ${src}`);
    process.exit(1);
  }
  if (existsSync(outAbs)) {
    // Idempotent: existierende Datei nicht erneut generieren. Bei Font-Update
    // einfach Output-Dateien löschen und Skript nochmal laufen lassen.
    continue;
  }
  mkdirSync(dirname(outAbs), { recursive: true });
  execSync(`pyftfeatfreeze -f tnum -S -U Tnum "${srcAbs}" "${outAbs}"`, {
    stdio: "inherit",
  });
  generatedFonts += 1;
}

if (generatedFonts > 0) {
  console.log(
    `[freeze-pdf-fonts] ${generatedFonts} Datei(en) mit tnum eingefroren`,
  );
}

// --- SVG ---

let generatedSvgs = 0;
for (const { src, out } of svgSources) {
  const srcAbs = resolve(repoRoot, src);
  const outAbs = resolve(repoRoot, out);
  if (!existsSync(srcAbs)) {
    console.warn(`[freeze-pdf-svg] Source nicht gefunden: ${src} - skip`);
    continue;
  }
  if (existsSync(outAbs)) {
    continue;
  }
  mkdirSync(dirname(outAbs), { recursive: true });
  const original = readFileSync(srcAbs, "utf-8");
  writeFileSync(outAbs, stripOklchFills(original), "utf-8");
  generatedSvgs += 1;
}

if (generatedSvgs > 0) {
  console.log(
    `[freeze-pdf-svg] ${generatedSvgs} SVG(s) für PDF-Renderer normalisiert`,
  );
}
