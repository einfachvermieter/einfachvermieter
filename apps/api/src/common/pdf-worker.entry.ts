/**
 * Worker-Thread-Einstieg für PDF-Rendering und SVG-Sanitizing.
 * Wird ausschließlich via `new Worker(...)` geladen, nie
 * statisch importiert
 */

import { parentPort } from "node:worker_threads";
import { SvgSanitizeError } from "../settings/sanitize-svg.js";
import { type PdfJob, runPdfJob } from "./pdf-render.js";

if (!parentPort) {
  throw new Error("pdf-worker.entry darf nur als Worker-Thread laufen");
}

const port = parentPort;

// Nur ein CPU-gebundener Render/Sanitize gleichzeitig,
// sonst würden mehrere `renderToBuffer` laufen.
let queue: Promise<void> = Promise.resolve();
port.on("message", (job: PdfJob & { id: number }) => {
  queue = queue.then(async () => {
    try {
      const result = await runPdfJob(job);

      port.postMessage({ id: job.id, ok: true, result });
    } catch (error) {
      const svgReason =
        error instanceof SvgSanitizeError ? error.reason : undefined;

      port.postMessage({
        id: job.id,
        ok: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
          svgReason,
        },
      });
    }
  });
});
