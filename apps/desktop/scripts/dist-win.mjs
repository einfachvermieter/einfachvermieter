#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * Startet electron-builder für Windows und trägt die Beta-Nummer als vierte
 * Stelle der Paketversion ein: 2026.1.0-beta.2 wird zu 2026.1.0.2. MSIX kennt
 * nur vier Zahlen, das Suffix faellt sonst weg. Eine stabile Version ohne
 * Suffix bekommt 0.
 */
const { version } = require("../package.json");
const betaNumber = /-beta\.(\d+)$/u.exec(version)?.[1];

const args = ["--win", ...process.argv.slice(2)];
if (betaNumber) {
  args.push(`-c.buildNumber=${betaNumber}`);
}
process.stdout.write(
  `[dist-win] ${version} -> Build-Nummer ${betaNumber ?? "0"}\n`,
);

const { status } = spawnSync(
  process.execPath,
  [require.resolve("electron-builder/out/cli/cli.js"), ...args],
  { stdio: "inherit" },
);
process.exit(status ?? 1);
