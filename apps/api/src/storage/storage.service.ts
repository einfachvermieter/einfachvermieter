import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dataDir } from "@einfachvermieter/db";
import { Injectable } from "@nestjs/common";

/**
 * Repo-Root analog zu packages/db/src/paths.ts. Wichtig: relative Pfade
 * dürfen NICHT gegen `process.cwd()` aufgelöst werden, weil der API-
 * Server je nach Startweg (turbo dev vs. node dist/main.js) ein anderes
 * CWD hat. Sonst landen Uploads und SQLite-DB an verschiedenen Orten.
 */
const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

/**
 * DI-Token für den Statement-PDF-Store (eigene Wurzel `${DATA_DIR}/statements`,
 * getrennt von den Benutzer-Uploads). Wird via `@Inject(STATEMENT_STORAGE)`
 * injiziert, der Default-`StorageService`-Token bleibt der Uploads-Store.
 */
export const STATEMENT_STORAGE = Symbol("STATEMENT_STORAGE");

/**
 * Basisverzeichnis für Benutzer-Uploads (Belege, Logo). Default
 * `${DATA_DIR}/uploads`, überschreibbar via `UPLOADS_DIR` (relativ -> repoRoot,
 * absolut -> 1:1).
 */
export const uploadsBaseDir = (): string => {
  const configured = process.env.UPLOADS_DIR;
  if (configured) {
    return isAbsolute(configured) ? configured : resolve(repoRoot, configured);
  }

  return join(dataDir(), "uploads");
};

/**
 * Basisverzeichnis für erstellte Abrechnungs-PDFs: `${DATA_DIR}/statements`.
 */
export const statementsBaseDir = (): string => join(dataDir(), "statements");

/**
 * Storage-Abstraktion für Dateien auf der Platte. Die Wurzel (Uploads bzw.
 * Statements) wird beim Provider-Setup übergeben, beide liegen getrennt
 * unter `${DATA_DIR}`.
 */
@Injectable()
export class StorageService {
  private readonly baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  /**
   * Schreibt Daten unter dem Key und legt fehlende Verzeichnisse an.
   */
  async write(key: string, data: Buffer): Promise<void> {
    const target = this.resolveSafe(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
  }

  /**
   * Liest die Datei zum Key
   */
  read(key: string): Promise<Buffer> {
    return readFile(this.resolveSafe(key));
  }

  /**
   * Löscht die Datei zum Key (kein Fehler, wenn sie nicht existiert)
   */
  async delete(key: string): Promise<void> {
    await rm(this.resolveSafe(key), { force: true });
  }

  /**
   * Entfernt rekursiv alles unterhalb des angegebenen Präfixes (inkl. des
   * Verzeichnisses selbst). Z.B. alle Belege und `.debug`-Sidecars einer
   * gelöschten Rechnung.
   */
  async deleteDirectory(prefix: string): Promise<void> {
    await rm(this.resolveSafe(prefix), { force: true, recursive: true });
  }

  /**
   * Löst den Key gegen das Basisverzeichnis auf und verhindert Path-Traversal
   */
  private resolveSafe(key: string): string {
    const target = resolve(this.baseDir, key);
    if (target !== this.baseDir && !target.startsWith(`${this.baseDir}/`)) {
      throw new Error(`Storage key escapes base directory: ${key}`);
    }

    return target;
  }
}

/**
 * Bildet den Storage-Key für einen Kostenbeleg-Anhang.
 *
 * @returns `cost-entries/<costEntryId>/<attachmentId>.<ext>` (Endung gesäubert).
 */
export const storageKeyForCostEntryAttachment = (
  costEntryId: string,
  attachmentId: string,
  extension: string,
): string => {
  const safeExt = extension.replace(/[^a-z0-9]/giu, "").toLowerCase();
  const suffix = safeExt ? `.${safeExt}` : "";

  return join("cost-entries", costEntryId, `${attachmentId}${suffix}`);
};

/**
 * Liefert den Storage-Key für die Mistral-Debug-Datei eines Anhangs.
 *
 * @returns Gleiches Verzeichnis wie die Originaldatei, gleicher Name, Endung
 * `.debug` statt der Originalendung.
 */
export const debugKeyFor = (storageKey: string): string => {
  const lastSlash = storageKey.lastIndexOf("/");
  const lastDot = storageKey.lastIndexOf(".");
  if (lastDot > lastSlash) {
    return `${storageKey.slice(0, lastDot)}.debug`;
  }

  return `${storageKey}.debug`;
};
