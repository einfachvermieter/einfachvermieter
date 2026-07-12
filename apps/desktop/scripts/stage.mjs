import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Baut das Server-Ressourcen-Verzeichnis für electron-builder (`staging/`,
 * landet im Paket unter `resources/app`). Spiegelt das Runtime-Layout des
 * Dockerfiles: Workspace-Struktur mit `apps/api/dist`, `apps/web/dist`,
 * den Package-dists und einer per `npm ci` erzeugten Produktions-
 * `node_modules` (nur die API-Workspace-Closure).
 *
 * Voraussetzung: `npm run build` im Repo-Root ist gelaufen.
 */
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(packageRoot, "../..");
const staging = join(packageRoot, "staging");

const copy = (relativePath) =>
  cpSync(join(repoRoot, relativePath), join(staging, relativePath), {
    recursive: true,
  });

const run = (command, options = {}) =>
  execSync(command, { cwd: staging, stdio: "inherit", ...options });

rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });

// Erst nur die Manifeste: solange `apps/web` noch kein Verzeichnis ist,
// matcht der Workspace-Glob `apps/*` beim `npm ci` nur die API.
for (const manifest of [
  "package.json",
  "package-lock.json",
  ".npmrc",
  "tsconfig.base.json",
  "apps/api/package.json",
  "packages/db/package.json",
  "packages/shared/package.json",
  "packages/pdf/package.json",
  "packages/i18n/package.json",
]) {
  copy(manifest);
}

// `ci` bewusst mit ignore-scripts (Repo-Default aus .npmrc): der Root-
// `postinstall` (PDF-Asset-Freeze) braucht den Quellbaum und liefe hier ins
// Leere. Nur der Rebuild der nativen Module braucht seine Build-Skripte.
run("npm ci --omit=dev --workspace=apps/api --include-workspace-root");
run("npm rebuild libsql argon2", {
  // biome-ignore lint/style/useNamingConvention: npm-Konfigurations-Env
  env: { ...process.env, npm_config_ignore_scripts: "false" },
});

// Danach die Builds und Assets (kein `src` nötig).
for (const artifact of [
  "apps/api/dist",
  "apps/web/dist",
  "packages/db/dist",
  "packages/shared/dist",
  "packages/pdf/dist",
  "packages/pdf/assets",
  "packages/i18n/dist",
]) {
  copy(artifact);
}
