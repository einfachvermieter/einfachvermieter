import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Von scripts/freeze-pdf-assets.mjs erzeugte PDF-Schnitte der Geist:
 * alle mit nachgerüstetem U+202F-Glyph, die tnum-Varianten zusätzlich
 * mit eingefrorenem tabular-figures-Feature.
 */
const assetFont = (name: string): string =>
  resolve(here, "..", "assets", "fonts", name);

// Geist hat keinen Italic-Schnitt. Daher wird kein Italic registriert.
// Das PDF nutzt kein `fontStyle: "italic"`
export const geistNormalPath = assetFont("geist-sans-pdf-400-normal.woff");
export const geistSemiboldPath = assetFont("geist-sans-pdf-600-normal.woff");

export const geistTnumNormalPath = assetFont(
  "geist-sans-pdf-tnum-400-normal.woff",
);
export const geistTnumSemiboldPath = assetFont(
  "geist-sans-pdf-tnum-600-normal.woff",
);
