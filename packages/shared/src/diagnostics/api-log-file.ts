import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { join } from "node:path";

/**
 * Obergrenze je Datei. Das Protokoll liegt neben der Datenbank, eine
 * Fehlerschleife darf die Platte nicht vollschreiben.
 */
const MAX_LOG_BYTES = 2_000_000;

/**
 * Ein Bericht enthält nur das Ende, sonst wird er bei einem lange laufenden
 * Server unnötig groß.
 */
const REPORT_TAIL_BYTES = 200_000;

const currentPath = (dir: string): string => join(dir, "api.log");

const rotatedPath = (dir: string): string => join(dir, "api.log.1");

/**
 * Nach einem Absturz wird meist erst neu gestartet und dann gemeldet.
 */
const previousPath = (dir: string): string => join(dir, "api.previous.log");

const readBytes = (path: string): Buffer =>
  existsSync(path) ? readFileSync(path) : Buffer.alloc(0);

const tail = (content: Buffer, limit: number): Buffer =>
  content.length > limit ? content.subarray(-limit) : content;

/**
 * Laufendes Protokoll samt umgelegtem Teil, damit das Ende auch direkt nach
 * dem Umlegen genug Zeilen hat
 */
const readCurrent = (dir: string, limit: number): Buffer =>
  tail(
    Buffer.concat([readBytes(rotatedPath(dir)), readBytes(currentPath(dir))]),
    limit,
  );

/**
 * Farbsteuerzeichen von Nest rausfiltern
 */
// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI-Steuerzeichen sind genau das Ziel
const ANSI_PATTERN = /\[[0-9;]*[A-Za-z]/gu;

const plainText = (chunk: string | Uint8Array): string =>
  (typeof chunk === "string"
    ? chunk
    : Buffer.from(chunk).toString("utf8")
  ).replace(ANSI_PATTERN, "");

/**
 * Legt das Protokoll der API in `dir` neu an und gibt die Schreibfunktion
 * zurück. Das Protokoll des vorherigen Starts wird vorher weggesichert.
 *
 * Schreibt synchron, damit auch die letzte Ausgabe vor einem Absturz in der
 * Datei steht. Scheitert das Schreiben (volle Platte, fehlende Rechte),
 * schaltet sich das Protokoll ab.
 */
export const openApiLog = (
  dir: string,
): ((chunk: string | Uint8Array) => void) => {
  let descriptor: number | null = null;
  let writtenBytes = 0;

  const open = (): void => {
    try {
      descriptor = openSync(currentPath(dir), "w");
      writtenBytes = 0;
    } catch {
      descriptor = null;
    }
  };

  const close = (): void => {
    if (descriptor === null) {
      return;
    }

    try {
      closeSync(descriptor);
    } finally {
      descriptor = null;
    }
  };

  try {
    mkdirSync(dir, { recursive: true });

    if (existsSync(currentPath(dir))) {
      writeFileSync(previousPath(dir), readCurrent(dir, MAX_LOG_BYTES));
      rmSync(rotatedPath(dir), { force: true });
    }
  } catch {
    // Ohne Sicherung des vorherigen Starts trotzdem mitschreiben.
  }

  open();

  return (chunk) => {
    if (descriptor === null) {
      return;
    }

    try {
      writtenBytes += writeSync(descriptor, plainText(chunk));

      if (writtenBytes > MAX_LOG_BYTES) {
        close();
        renameSync(currentPath(dir), rotatedPath(dir));
        open();
      }
    } catch {
      try {
        close();
      } catch {
        // Protokoll bleibt abgeschaltet.
      }
    }
  };
};

const asText = (content: Buffer): string | null =>
  content.length > 0 ? content.toString("utf8") : null;

/**
 * Ende des laufenden und des vorherigen Protokolls für den Fehlerbericht;
 * `null`, wenn das jeweilige Protokoll fehlt oder leer ist
 */
export const readApiLogs = (
  dir: string,
): { current: string | null; previous: string | null } => ({
  current: asText(readCurrent(dir, REPORT_TAIL_BYTES)),
  previous: asText(tail(readBytes(previousPath(dir)), REPORT_TAIL_BYTES)),
});
