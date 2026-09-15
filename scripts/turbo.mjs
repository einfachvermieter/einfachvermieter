#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

/**
 * Startet turbo mit abgeschalteter Telemetrie. Turbo kennt dafür nur die
 * Umgebungsvariable, und `VAR=1 befehl` versteht die Windows-Shell von npm
 * nicht.
 */
const turbo = createRequire(import.meta.url).resolve("turbo/bin/turbo");
const child = spawn(process.execPath, [turbo, ...process.argv.slice(2)], {
  stdio: "inherit",
  // biome-ignore lint/style/useNamingConvention: Umgebungsvariable von turbo
  env: { ...process.env, TURBO_TELEMETRY_DISABLED: "1" },
});

// Strg+C erreicht die ganze Prozessgruppe, turbo bekommt es also selbst. Ohne
// eigenen Handler stirbt dieser Prozess sofort, die Shell zeigt wieder ihre
// Eingabezeile, und das noch aufräumende turbo überschreibt sie mit seiner
// letzten Ausgabe. Das Terminal wirkt dann tot, bis man erneut Strg+C drückt.
process.on("SIGINT", () => {
  // Nichts tun, turbo räumt selbst auf; wir warten nur auf sein Ende.
});

// SIGTERM geht nur an diesen Prozess. Ohne Weiterreichen liefe turbo nach
// einem `kill` als Waise weiter.
process.on("SIGTERM", () => child.kill("SIGTERM"));

child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
