#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

/**
 * Startet turbo mit abgeschalteter Telemetrie. Turbo kennt dafür nur die
 * Umgebungsvariable, und `VAR=1 befehl` versteht die Windows-Shell von npm
 * nicht.
 */
const turbo = createRequire(import.meta.url).resolve("turbo/bin/turbo");
const { status } = spawnSync(
  process.execPath,
  [turbo, ...process.argv.slice(2)],
  {
    stdio: "inherit",
    // biome-ignore lint/style/useNamingConvention: Umgebungsvariable von turbo
    env: { ...process.env, TURBO_TELEMETRY_DISABLED: "1" },
  },
);
process.exit(status ?? 1);
