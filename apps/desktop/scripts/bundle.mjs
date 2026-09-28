import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

/**
 * Bündelt den Electron-Main-Prozess in eine einzige CJS-Datei. Das i18n-Paket
 * (inkl. i18next) wird mitgebündelt. Die gepackte App braucht dadurch keine
 * eigenen node_modules; nur `electron` selbst bleibt extern.
 *
 * Veröffentlichungsweg (z.B. win-store, macos-download) entweder per ENV
 * `APP_PLATFORM` oder als erstes Argument.
 *
 * Die Produktversion wird hier eingebrannt, weil `app.getVersion()` im
 * Windows-Paket die MSIX-Paketversion liefert und nicht die Nummer,
  die Nutzer und Versionsprüfung sehen sollen.
 */
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const appPlatform = process.env.APP_PLATFORM?.trim() || process.argv[2] || "";
const { version } = createRequire(import.meta.url)("../package.json");

/**
 * Testkopie (von scripts/sync-win-test.mjs übertragen, erkennbar an
 * `.test-build` im Repo-Root): eigener App-Name und Plattform-Schlüssel,
 * damit sie nie mit einer echten Installation verwechselt wird.
 */
const testBuild = existsSync(join(packageRoot, "../../.test-build"));

await build({
  entryPoints: [join(packageRoot, "src/preload.ts")],
  outfile: join(packageRoot, "dist/preload.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
});

await build({
  entryPoints: [join(packageRoot, "src/main.ts")],
  outfile: join(packageRoot, "dist/main.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
  // Ladeseite des Hauptprozesses: Logo als Text, Hausschriften als data-URL.
  loader: { ".svg": "text", ".woff2": "dataurl" },
  define: {
    // biome-ignore lint/style/useNamingConvention: esbuild-Konstante
    __APP_PLATFORM__: JSON.stringify(appPlatform),
    // biome-ignore lint/style/useNamingConvention: esbuild-Konstante
    __APP_VERSION__: JSON.stringify(version),
    // biome-ignore lint/style/useNamingConvention: esbuild-Konstante
    __APP_TEST_BUILD__: JSON.stringify(testBuild),
  },
});
