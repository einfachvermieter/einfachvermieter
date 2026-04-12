// Dev-Runner der API mit Live-Reload über Paketgrenzen hinweg.
//
// `nest start --watch` startet den Node-Prozess nur neu, wenn sich der
// API-eigene Quellcode ändert, nicht, wenn sich kompilierte Dependencies wie
// @einfachvermieter/i18n oder @einfachvermieter/pdf ändern.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const children = [];

const run = (command, args) => {
  const child = spawn(command, args, { stdio: "inherit" });
  children.push(child);
  return child;
};

run("nest", ["build", "--watch", "--preserveWatchOutput"]);

while (!existsSync("dist/main.js")) {
  await sleep(200);
}

run("node", [
  "--watch-path=dist",
  "--watch-path=../../packages/i18n/dist",
  "--watch-path=../../packages/pdf/dist",
  "--watch-path=../../packages/shared/dist",
  "--watch-path=../../packages/db/dist",
  "dist/main.js",
]);

const shutdown = (signal) => {
  for (const child of children) {
    child.kill(signal);
  }
  process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
