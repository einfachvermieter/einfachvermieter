#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

const BETA_BLOCK = 900;

/**
 * Rechnet die Produktversion in die Paketversion um, die ins MSIX-Manifest
 * geht. MSIX kennt nur vier Ganzzahlen und kein `-beta.N`, und die vierte
 * Stelle ist dem Store vorbehalten (sie muss 0 bleiben). Für die
 * Reihenfolge bleiben also drei Stellen, und die muss über alle
 * Übermittlungen derselben App hinweg aufsteigen.
 *
 * Vorabversionen liegen deshalb unterhalb ihrer Zielversion, im 900er-Block
 * der vorigen Minor-Reihe: 2026.1.0-beta.1 wird 2026.0.901, die fertige
 * 2026.1.0 bleibt 2026.1.0. Damit trägt jede fertige Version im Store exakt
 * ihre Produktnummer, der Block liegt über allen realistischen Patch-
 * Ständen der vorigen Reihe, und die fertige Version holt Tester, die auf
 * einer Beta stehen geblieben sind, immer ein.
 */
export const toPackageVersion = (version) => {
  const parts = /^(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/u.exec(version);
  if (!parts) {
    throw new Error(`Versionsnummer nicht verwertbar: ${version}`);
  }

  const [, major, minor, patch, betaNumber] = parts;
  if (betaNumber === undefined) {
    return `${major}.${minor}.${patch}`;
  }
  if (patch !== "0") {
    throw new Error(`Vorabversion nur zu X.Y.0 vorgesehen: ${version}`);
  }
  if (minor === "0") {
    throw new Error(`Unterhalb von Minor 0 ist kein Platz: ${version}`);
  }

  return `${major}.${Number(minor) - 1}.${BETA_BLOCK + Number(betaNumber)}`;
};

// Nur beim direkten Aufruf bauen, damit ein Import die Umrechnung liefern
// kann, ohne electron-builder zu starten.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { version } = require("../package.json");
  const packageVersion = toPackageVersion(version);

  process.stdout.write(
    `[dist-win] ${version} -> Paketversion ${packageVersion}.0\n`,
  );

  // Die Paketversion kommt nur über die Metadaten ins Manifest;
  // electron-builder leitet `${version}` daraus ab. Die Produktversion zeigt
  // die App aus der beim Bündeln eingebrannten Konstante (siehe bundle.mjs).
  const { status } = spawnSync(
    process.execPath,
    [
      require.resolve("electron-builder/out/cli/cli.js"),
      "--win",
      `-c.extraMetadata.version=${packageVersion}`,
      ...process.argv.slice(2),
    ],
    { stdio: "inherit" },
  );
  process.exit(status ?? 1);
}
