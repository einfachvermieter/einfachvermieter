import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

/**
 * Bündelt den Electron-Main-Prozess in eine einzige CJS-Datei. Das i18n-Paket
 * (inkl. i18next) wird mitgebündelt. Die gepackte App braucht dadurch keine
 * eigenen node_modules; nur `electron` selbst bleibt extern.
 *
 * `APP_PLATFORM` brennt den Veröffentlichungsweg des Pakets ein
 * (z.B. win-store, macos-download)
 */
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

await build({
  entryPoints: [join(packageRoot, "src/main.ts")],
  outfile: join(packageRoot, "dist/main.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
  define: {
    // biome-ignore lint/style/useNamingConvention: esbuild-Konstante
    __APP_PLATFORM__: JSON.stringify(process.env.APP_PLATFORM?.trim() ?? ""),
  },
});
