import { dataDir } from "@einfachvermieter/db";
import {
  openApiLog,
  readApiLogs,
} from "@einfachvermieter/shared/diagnostics/api-log-file";

type WriteFn = typeof process.stdout.write;

const copyWritesToLog = (
  stream: NodeJS.WriteStream,
  writeLog: (chunk: string | Uint8Array) => void,
): void => {
  const original = stream.write.bind(stream) as WriteFn;

  stream.write = ((
    chunk: string | Uint8Array,
    encoding?: BufferEncoding | ((error?: Error | null) => void),
    callback?: (error?: Error | null) => void,
  ): boolean => {
    writeLog(chunk);

    return typeof encoding === "function"
      ? original(chunk, encoding)
      : original(chunk, encoding, callback);
  }) as WriteFn;
};

/**
 * Schreibt alles, was der Server ausgibt, zusätzlich in eine Datei neben den
 * Daten. Muss vor dem Hochfahren von Nest laufen, damit auch Startfehler
 * drinstehen.
 *
 * In der Desktop-App schreibt der Electron-Hauptprozess dieselbe Datei. Er
 * liest die Ausgabe ohnehin mit und erfasst auch Abstürze, deren Meldung
 * Node direkt an den Kanal schreibt, vorbei an `process.stderr`.
 */
export const startApiLogFile = (): void => {
  if (process.env.API_LOG_BY_PARENT === "true") {
    return;
  }

  const writeLog = openApiLog(dataDir());
  copyWritesToLog(process.stdout, writeLog);
  copyWritesToLog(process.stderr, writeLog);
};

export const readApiLogTails = (): ReturnType<typeof readApiLogs> =>
  readApiLogs(dataDir());
