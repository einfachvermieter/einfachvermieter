#!/usr/bin/env node
// biome-ignore-all lint/nursery/noUndeclaredEnvVars: Aufruf von Hand, kein Turbo-Task
import { spawn, spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Überträgt den Arbeitsstand zum Testen auf einen Windows-Rechner und baut
 * ihn dort. Nur für Tests: Veröffentlichte Pakete entstehen weiter aus einem
 * frischen Klon von GitHub.
 *
 * Die Kopie landet in einem eigenen Ordner und bekommt `.test-build`; damit
 * trägt die App einen eigenen Namen, Datenordner und eine eigene
 * Paketidentität (siehe apps/desktop/scripts/bundle.mjs und dist-win.mjs).
 *
 * Aufruf: `WIN_TEST_HOST=user@rechner [WIN_TEST_SSH_KEY=~/.ssh/key]
 * [WIN_TEST_DIR=C:/dev/einfachvermieter-test] node scripts/sync-win-test.mjs`
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const host = process.env.WIN_TEST_HOST;
const sshKey = process.env.WIN_TEST_SSH_KEY;
const targetDir = process.env.WIN_TEST_DIR ?? "C:/dev/einfachvermieter-test";

if (!host) {
  process.stderr.write("WIN_TEST_HOST fehlt (z. B. markus@rechner)\n");
  process.exit(1);
}

const sshArgs = [
  ...(sshKey ? ["-o", "IdentitiesOnly=yes", "-i", sshKey] : []),
  host,
];

/**
 * Zusätzlich zu .gitignore und .git/info/exclude: was nie auf einen anderen
 * Rechner gehört, auch wenn es einmal nicht ignoriert sein sollte
 */
const excludedPaths = [
  /(^|\/)node_modules\//u,
  /(^|\/)dist\//u,
  /(^|\/)\.env(\.local)?$/u,
  /(^|\/)\.claude\//u,
  /(^|\/)CLAUDE\.md$/u,
  /^docs-internal\//u,
  /^\.playwright-mcp\//u,
  /^data\//u,
  /\.db(-shm|-wal)?$/u,
  /^packages\/db\/scripts\/seed\/local\.ts$/u,
  /^packages\/db\/scripts\/seed-fixtures\/local\//u,
  /^apps\/desktop\/(staging|release)/u,
];

// Was git veröffentlichen würde (eingecheckt oder neu, nicht ignoriert)
const listed = spawnSync(
  "git",
  ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
  { cwd: repoRoot, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
);
if (listed.status !== 0) {
  process.stderr.write(listed.stderr);
  process.exit(1);
}

const files = listed.stdout
  .split("\0")
  .filter(
    (path) =>
      path.length > 0 &&
      !excludedPaths.some((pattern) => pattern.test(path)) &&
      existsSync(join(repoRoot, path)) &&
      statSync(join(repoRoot, path)).isFile(),
  );

/**
 * Führt ein PowerShell-Skript auf dem Windows-Rechner aus.
 */
const runRemote = (script) => {
  const encoded = Buffer.from(
    `$ProgressPreference = 'SilentlyContinue'\n${script}`,
    "utf16le",
  ).toString("base64");
  const { status } = spawnSync(
    "ssh",
    [...sshArgs, "powershell -NoProfile -EncodedCommand", encoded],
    { stdio: "inherit" },
  );
  if (status !== 0) {
    process.exit(status ?? 1);
  }
};

const psTarget = targetDir.replaceAll("/", "\\").replaceAll("'", "''");

// Alten Stand bis auf node_modules leeren, sonst bleiben gelöschte Dateien
// (z. B. alte Migrationen) liegen.
runRemote(`
$ErrorActionPreference = 'Stop'
$target = '${psTarget}'
New-Item -ItemType Directory -Force -Path $target | Out-Null
function Clear-Tree($dir) {
  Get-ChildItem -Force -LiteralPath $dir | ForEach-Object {
    if ($_.Name -eq 'node_modules') { return }
    if ($_.PSIsContainer) {
      Clear-Tree $_.FullName
      # Leere Ordner nur aufräumen; ein Ordner, in dem gerade eine Konsole steht, bleibt
      if (-not (Get-ChildItem -Force -LiteralPath $_.FullName)) { Remove-Item -Force -LiteralPath $_.FullName -ErrorAction SilentlyContinue }
    } else {
      Remove-Item -Force -LiteralPath $_.FullName
    }
  }
}
Clear-Tree $target
`);

process.stdout.write(`${files.length} Dateien nach ${host}:${targetDir}\n`);

await new Promise((resolve, reject) => {
  const tar = spawn("tar", ["-czf", "-", "--null", "-T", "-"], {
    cwd: repoRoot,
    // Keine ._-Dateien mit macOS-Metadaten
    // biome-ignore lint/style/useNamingConvention: ENV-Variable von tar
    env: { ...process.env, COPYFILE_DISABLE: "1" },
    stdio: ["pipe", "pipe", "inherit"],
  });
  const ssh = spawn("ssh", [...sshArgs, `tar -xzf - -C "${targetDir}"`], {
    stdio: [tar.stdout, "inherit", "inherit"],
  });
  tar.stdin.end(`${files.join("\0")}\0`);
  ssh.on("error", reject);
  ssh.on("close", (code) =>
    code === 0 ? resolve() : reject(new Error(`Übertragung: Exit ${code}`)),
  );
});

// npm ci nur bei geändertem Lockfile; der Hash liegt in node_modules und
// überlebt damit das Leeren.
runRemote(`
$ErrorActionPreference = 'Continue'
Set-Location '${psTarget}'
New-Item -ItemType File -Force -Path .test-build | Out-Null
$lockHash = (Get-FileHash package-lock.json).Hash
$hashFile = 'node_modules\\.lock-hash'
if (-not (Test-Path $hashFile) -or (Get-Content $hashFile) -ne $lockHash) {
  npm ci
  if ($LASTEXITCODE -ne 0) { exit 1 }
  npm run rebuild:native
  if ($LASTEXITCODE -ne 0) { exit 1 }
  Set-Content -Path $hashFile -Value $lockHash
}
npm run freeze-pdf-assets
if ($LASTEXITCODE -ne 0) { exit 1 }
npm run build
if ($LASTEXITCODE -ne 0) { exit 1 }
''
'Fertig. Start in einer Windows-Sitzung:'
'  cd ${psTarget}\\apps\\desktop'
'  npx electron .'
`);
