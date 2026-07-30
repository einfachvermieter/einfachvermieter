#!/usr/bin/env node
/**
 * Erzeugt die PDF-Renderer-Assets (react-pdf) aus den App-Quellen:
 *
 * 1. Fonts: PDF-Schnitte der Hausschrift "Geist" in zwei Schritten:
 *    a) Für die Tabellen-Schnitte wird das OpenType-Feature `tnum`
 *       (tabular figures) eingefroren - react-pdf v4 hat keine Style-API
 *       für OT-Features, daher wird das Feature direkt in die
 *       Default-Glyphen "eingebacken".
 *       Tool: pyftfeatfreeze (pip install opentype-feature-freezer).
 *    b) Alle Schnitte bekommen ein Glyph für U+202F (schmales geschütztes
 *       Leerzeichen) nachgerüstet - das Latin-Subset enthält keins, und
 *       react-pdf rendert Zeichen ohne Glyph mit Nullbreite
 *       (scripts/pdf-font-add-nnbsp.py, braucht fontTools).
 *    Pflicht-Abhängigkeiten: Fehlt ein Tool, bricht das Skript mit Fehler
 *    ab - es gibt keinen stillen Fallback, da tabular-nums-Ausrichtung und
 *    geschützte Leerzeichen in den Abrechnungs-PDFs verbindlich sind.
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
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(import.meta.url), "..", "..");

const fontSources = [
  {
    src: "node_modules/@fontsource/geist-sans/files/geist-sans-latin-400-normal.woff",
    out: "packages/pdf/assets/fonts/geist-sans-pdf-400-normal.woff",
    tnum: false,
  },
  {
    src: "node_modules/@fontsource/geist-sans/files/geist-sans-latin-600-normal.woff",
    out: "packages/pdf/assets/fonts/geist-sans-pdf-600-normal.woff",
    tnum: false,
  },
  {
    src: "node_modules/@fontsource/geist-sans/files/geist-sans-latin-400-normal.woff",
    out: "packages/pdf/assets/fonts/geist-sans-pdf-tnum-400-normal.woff",
    tnum: true,
  },
  {
    src: "node_modules/@fontsource/geist-sans/files/geist-sans-latin-600-normal.woff",
    out: "packages/pdf/assets/fonts/geist-sans-pdf-tnum-600-normal.woff",
    tnum: true,
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

/**
 * Python-Interpreter mit fontTools finden. Bevorzugt `python3` direkt;
 * fällt zurück auf den Interpreter aus dem Shebang von pyftfeatfreeze,
 * dessen Umgebung (z. B. pipx-Venv) fontTools garantiert enthält.
 */
const resolveFontToolsPython = () => {
  const canImport = (interpreter) =>
    spawnSync(interpreter, ["-c", "import fontTools"], { stdio: "ignore" })
      .status === 0;
  if (canImport("python3")) {
    return "python3";
  }
  const which = spawnSync("which", ["pyftfeatfreeze"], { encoding: "utf-8" });
  if (which.status === 0) {
    const [shebang] = readFileSync(which.stdout.trim(), "utf-8").split("\n");
    if (shebang.startsWith("#!")) {
      const interpreter = shebang.slice(2).trim();
      if (existsSync(interpreter) && canImport(interpreter)) {
        return interpreter;
      }
    }
  }
  return null;
};

const fontToolsPython = resolveFontToolsPython();
if (fontToolsPython === null) {
  console.error(
    "[freeze-pdf-fonts] FEHLER: Kein Python mit fontTools gefunden. Das",
    "U+202F-Glyph für die Abrechnungs-PDFs kann nicht nachgerüstet werden.",
  );
  console.error(
    "[freeze-pdf-fonts] Installieren mit:",
    "  pip install fonttools",
    "  npm run freeze-pdf-assets",
  );
  process.exit(1);
}

const nnbspPatchScript = resolve(repoRoot, "scripts/pdf-font-add-nnbsp.py");

let generatedFonts = 0;
for (const { src, out, tnum } of fontSources) {
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
  let patchInput = srcAbs;
  if (tnum) {
    const tnumTmp = `${outAbs}.tnum-tmp`;
    execSync(`pyftfeatfreeze -f tnum -S -U Tnum "${srcAbs}" "${tnumTmp}"`, {
      stdio: "inherit",
    });
    patchInput = tnumTmp;
  }
  execSync(
    `"${fontToolsPython}" "${nnbspPatchScript}" "${patchInput}" "${outAbs}"`,
    { stdio: "inherit" },
  );
  if (patchInput !== srcAbs) {
    rmSync(patchInput);
  }
  generatedFonts += 1;
}

if (generatedFonts > 0) {
  console.log(
    `[freeze-pdf-fonts] ${generatedFonts} PDF-Schnitt(e) erzeugt (U+202F nachgerüstet, tnum-Varianten eingefroren)`,
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
