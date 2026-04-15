import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const fontsourceDir = dirname(
  require.resolve("@fontsource/geist-sans/package.json"),
);

const fontsourceFile = (name: string): string =>
  resolve(fontsourceDir, "files", name);

const tnumFile = (name: string): string =>
  resolve(here, "..", "assets", "fonts", name);

// Geist hat keinen Italic-Schnitt. Daher wird kein Italic registriert.
// Das PDF nutzt kein `fontStyle: "italic"`
export const geistNormalPath = fontsourceFile(
  "geist-sans-latin-400-normal.woff",
);
export const geistSemiboldPath = fontsourceFile(
  "geist-sans-latin-600-normal.woff",
);

// tnum-Variante mit eingefrorenem Feature (siehe scripts/freeze-pdf-assets.mjs).
export const geistTnumNormalPath = tnumFile("geist-sans-tnum-400-normal.woff");
export const geistTnumSemiboldPath = tnumFile(
  "geist-sans-tnum-600-normal.woff",
);
