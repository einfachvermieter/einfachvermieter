import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const resolveAgainstRoot = (raw: string): string =>
  isAbsolute(raw) ? raw : resolve(repoRoot, raw);

/**
 * Wurzel fuer alle volatilen Daten (SQLite-DB, Uploads, erstellte
 * Abrechnungen). Per ENV `DATA_DIR` konfigurierbar (absolut oder relativ zum
 * repoRoot), Default `<repoRoot>/data`. Im Container auf `/data` gesetzt und
 * als Volume gemountet.
 */
export const dataDir = (): string => {
  const raw = process.env.DATA_DIR;

  return raw ? resolveAgainstRoot(raw) : resolve(repoRoot, "data");
};

export const defaultDbPath = (): string =>
  resolve(dataDir(), "einfachvermieter.db");

export const resolveDbPath = (override?: string): string => {
  const raw = override ?? process.env.DATABASE_URL;
  const path = raw ? resolveAgainstRoot(raw) : defaultDbPath();

  mkdirSync(dirname(path), { recursive: true });

  return path;
};
