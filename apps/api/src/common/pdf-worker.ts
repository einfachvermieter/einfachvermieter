/**
 * Manager für den PDF-/SVG-Worker. react-pdf layoutet CPU-gebunden in JS und
 * das SVG-Sanitizing geht per JSDOM synchron. Beides blockiert sonst den
 * Event Loop für alle parallelen Requests. Deshalb das ganze über einen Worker-Thread:
 * er serialisiert die Jobs intern nd hält den Haupt-Loop frei.
 *
 * Fällt auf In-Process-Rendering zurück, wenn kein gebauter Worker-Einstieg
 * vorliegt (z.B. vitest)
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import type {
  LogoPreviewDocumentProps,
  StatementDocumentProps,
} from "@einfachvermieter/pdf";
import {
  SvgSanitizeError,
  type SvgSanitizeReason,
} from "../settings/sanitize-svg.js";
import type { PdfJob } from "./pdf-render.js";

type WorkerResponse =
  | { id: number; ok: true; result: Uint8Array | string }
  | {
      id: number;
      ok: false;
      error: { message: string; svgReason?: SvgSanitizeReason };
    };

const workerUrl = new URL("./pdf-worker.entry.js", import.meta.url);

/**
 * Nur nutzbar, wenn der Worker als gebautes `.js` neben diesem Modul liegt
 * (Regelbetrieb aus `dist`). Unter Vitest fehlt es -> In-Process.
 */
const workerAvailable = existsSync(fileURLToPath(workerUrl));

let worker: Worker | null = null;
let nextJobId = 1;
const pending = new Map<
  number,
  {
    resolve: (value: Uint8Array | string) => void;
    reject: (error: Error) => void;
  }
>();

const rejectAllPending = (error: Error): void => {
  worker = null;
  for (const entry of pending.values()) {
    entry.reject(error);
  }
  pending.clear();
};

const ensureWorker = (): Worker => {
  if (worker) {
    return worker;
  }

  const spawned = new Worker(workerUrl);
  spawned.on("message", (message: WorkerResponse) => {
    const entry = pending.get(message.id);
    if (!entry) {
      return;
    }
    pending.delete(message.id);
    if (message.ok) {
      entry.resolve(message.result);
    } else {
      entry.reject(
        message.error.svgReason
          ? new SvgSanitizeError(message.error.svgReason)
          : new Error(message.error.message),
      );
    }
  });

  spawned.on("error", rejectAllPending);
  spawned.on("exit", (code) => {
    if (code !== 0) {
      rejectAllPending(
        new Error(`PDF-Worker unerwartet beendet (Code ${code})`),
      );
    }
  });

  // Idle-Worker darf den Prozess nicht am Beenden hindern
  spawned.unref();

  worker = spawned;
  return spawned;
};

const submit = (job: PdfJob): Promise<Uint8Array | string> => {
  if (!workerAvailable) {
    return import("./pdf-render.js").then((module) => module.runPdfJob(job));
  }

  return new Promise((resolve, reject) => {
    const id = nextJobId++;
    pending.set(id, { resolve, reject });
    ensureWorker().postMessage({ id, ...job });
  });
};

/**
 * Rendert das Nebenkostenabrechnungs-PDF
 */
export const renderStatementDocument = (
  props: StatementDocumentProps,
): Promise<Buffer> =>
  submit({ type: "statement", payload: props }).then((result) =>
    Buffer.from(result as Uint8Array),
  );

/**
 * Rendert die Logo-Vorschau/PDF
 */
export const renderLogoDocument = (
  props: LogoPreviewDocumentProps,
): Promise<Buffer> =>
  submit({ type: "logo", payload: props }).then((result) =>
    Buffer.from(result as Uint8Array),
  );

/**
 * Härtet ein Logo-SVG im Worker-Thread
 */
export const sanitizeSvgInWorker = (rawSvg: string): Promise<string> =>
  submit({ type: "sanitize", payload: rawSvg }) as Promise<string>;
