import { execSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPackageWithOptions } from "@electron/asar";

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

// npm verlinkt die Workspace-Pakete in node_modules (unter Windows als
// Junction). `makeappx` lehnt Verzeichnis-Verknüpfungen ab, deshalb echte
// Kopien. Muss nach dem Kopieren der Build-Ergebnisse laufen, sonst fehlen
// den Kopien die dist-Verzeichnisse.
const linkedScope = join(staging, "node_modules/@einfachvermieter");
for (const entry of readdirSync(linkedScope)) {
  const linkPath = join(linkedScope, entry);
  const target = realpathSync(linkPath);
  if (target === linkPath) {
    continue;
  }
  rmSync(linkPath, { recursive: true, force: true });
  cpSync(target, linkPath, { recursive: true, dereference: true });
}

// Aufräumen: Dateien, die zur Laufzeit niemand liest. Erhöht die Ladezeit
// beim ersten ansonsten Starten enorm.
const PRUNED_DIRECTORIES = new Set([
  "test",
  "tests",
  "__tests__",
  "example",
  "examples",
  "docs",
  ".github",
]);
// `typescript` hängt nur als Typquelle an i18next, geladen wird es nie.
const PRUNED_PACKAGES = ["typescript"];

// Die Desktop-App läuft immer auf der eingebetteten SQLite (libsql). Die
// beiden Server-Dialekte und ihre Libs können raus.
const UNUSED_DIALECTS = ["@mikro-orm/postgresql", "@mikro-orm/mariadb"];

const readManifest = (packageDir) => {
  const manifestPath = join(packageDir, "package.json");
  return existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, "utf8"))
    : null;
};

/**
 * Sucht ein Paket wie Node: erst im `node_modules` des Verzeichnisses, dann
 * aufwärts bis zur Staging-Wurzel.
 */
const resolveDependency = (fromDir, name) => {
  let current = fromDir;

  while (current.startsWith(staging)) {
    const candidate = join(current, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) {
      return candidate;
    }
    current = dirname(current);
  }

  return null;
};

/**
 * Alle von Staging-Wurzel und API aus erreichbaren Paketverzeichnisse.
 * `blocked` kappt Kanten, damit sich zwei Läufe vergleichen lassen.
 */
const reachablePackages = (blocked) => {
  const found = new Set();

  const visit = (packageDir) => {
    const manifest = readManifest(packageDir);
    if (!manifest) {
      return;
    }

    const dependencies = {
      ...manifest.dependencies,
      ...manifest.optionalDependencies,
      ...manifest.peerDependencies,
    };

    for (const name of Object.keys(dependencies)) {
      if (blocked.includes(name)) {
        continue;
      }

      const target = resolveDependency(packageDir, name);
      if (!target || found.has(target)) {
        continue;
      }

      found.add(target);
      visit(target);
    }
  };

  visit(staging);
  visit(join(staging, "apps/api"));

  return found;
};

/**
 * Pakete, die es nur wegen der ungenutzten Dialekte gibt (die Dialekt-Pakete
 * selbst eingeschlossen).
 */
const dbDialectOnlyPackages = () => {
  const withDialects = reachablePackages([]);
  const withoutDialects = reachablePackages(UNUSED_DIALECTS);

  return [...withDialects].filter(
    (packageDir) => !withoutDialects.has(packageDir),
  );
};

const currentPlatform = `${process.platform}-${process.arch}`;

const isDisposable = (name) =>
  name.endsWith(".map") ||
  name.endsWith(".ts") ||
  (name.endsWith(".md") && !name.startsWith("LICENSE"));

const prune = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      const foreignPlatform =
        basename(directory) === "prebuilds" && entry.name !== currentPlatform;
      if (PRUNED_DIRECTORIES.has(entry.name) || foreignPlatform) {
        rmSync(entryPath, { recursive: true, force: true });
        continue;
      }
      prune(entryPath);
    } else if (entry.isFile() && isDisposable(entry.name)) {
      rmSync(entryPath, { force: true });
    }
  }
};

const measure = (directory) => {
  let files = 0;
  let bytes = 0;
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const entryPath = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
      } else if (entry.isFile()) {
        files += 1;
        bytes += statSync(entryPath).size;
      }
    }
  };
  walk(directory);
  return { files, mb: Math.round(bytes / 1024 / 1024) };
};

const before = measure(staging);
for (const packageName of PRUNED_PACKAGES) {
  rmSync(join(staging, "node_modules", packageName), {
    recursive: true,
    force: true,
  });
}

for (const packageDir of dbDialectOnlyPackages()) {
  rmSync(packageDir, { recursive: true, force: true });
}

prune(join(staging, "node_modules"));

const after = measure(staging);
process.stdout.write(
  `[stage] bereinigt: ${before.files} -> ${after.files} Dateien, ${before.mb} -> ${after.mb} MB\n`,
);

// Server-Ressourcen als Archiv ausliefern. Native Module bleiben ausgepackt,
// Windows lädt DLLs nur aus echten Dateien; Electron findet sie über das
// Archiv-Register.
const archive = join(packageRoot, "staging.asar");
rmSync(archive, { force: true });
rmSync(`${archive}.unpacked`, { recursive: true, force: true });
await createPackageWithOptions(staging, archive, { unpack: "**/*.node" });
const unpacked = measure(`${archive}.unpacked`);
process.stdout.write(
  `[stage] Archiv: ${Math.round(statSync(archive).size / 1024 / 1024)} MB, ausgepackt daneben ${unpacked.files} Dateien\n`,
);
