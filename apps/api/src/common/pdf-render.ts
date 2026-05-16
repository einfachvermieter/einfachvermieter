/**
 * Reine Render-/Sanitize-Dispatch der CPU-gebundenen PDF-Arbeit. Wird im
 * Regelbetrieb im Worker-Thread geladen (`pdf-worker.entry.ts`), im Test-Lauf
 * (kein gebauter Worker vorhanden) direkt in-process
 */

import { existsSync } from "node:fs";
import {
  appLogoPath,
  geistNormalPath,
  geistSemiboldPath,
  geistTnumNormalPath,
  geistTnumSemiboldPath,
  LogoPreviewDocument,
  type LogoPreviewDocumentProps,
  StatementDocument,
  type StatementDocumentProps,
} from "@einfachvermieter/pdf";
import { type DocumentProps, Font, renderToBuffer } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { sanitizeSvgLogo } from "../settings/sanitize-svg.js";

const missingPdfAssets = [
  appLogoPath,
  geistNormalPath,
  geistSemiboldPath,
  geistTnumNormalPath,
  geistTnumSemiboldPath,
].filter((assetPath) => !existsSync(assetPath));
if (missingPdfAssets.length > 0) {
  throw new Error(
    `PDF-Assets fehlen! Bitte \`npm run setup\` im Repo-Root ausführen. Fehlende Dateien:\n${missingPdfAssets.join("\n")}`,
  );
}

// Modul-weite Font-Registrierung: react-pdf hält die Font-Registry global
Font.register({
  family: "Geist",
  fonts: [
    { src: geistNormalPath, fontWeight: 400 },
    { src: geistSemiboldPath, fontWeight: 600 },
  ],
});
Font.register({
  family: "Geist Tnum",
  fonts: [
    { src: geistTnumNormalPath, fontWeight: 400 },
    { src: geistTnumSemiboldPath, fontWeight: 600 },
  ],
});

// Selbe Regel wie im Frontend: keine Hyphenation,
// sonst trennt react-pdf Tabellen-Zellen mit Bindestrich.
Font.registerHyphenationCallback((word) => [word]);

export type PdfJob =
  | { type: "statement"; payload: StatementDocumentProps }
  | { type: "logo"; payload: LogoPreviewDocumentProps }
  | { type: "sanitize"; payload: string };

/**
 * Führt einen PDF-/Sanitize-Job aus. Rückgabe ist serialisierbar (Buffer bzw.
 * String), damit sie über die Worker-Grenze gepostet werden kann.
 */
export const runPdfJob = (job: PdfJob): Promise<Uint8Array | string> => {
  switch (job.type) {
    // Liefert intern ein `<Document>` zurück
    case "statement":
      return renderToBuffer(
        createElement(
          StatementDocument,
          job.payload,
        ) as unknown as ReactElement<DocumentProps>,
      );

    case "logo":
      return renderToBuffer(
        createElement(
          LogoPreviewDocument,
          job.payload,
        ) as unknown as ReactElement<DocumentProps>,
      );

    case "sanitize":
      return Promise.resolve(sanitizeSvgLogo(job.payload));

    default:
      return Promise.reject(
        new Error(`Unbekannter PDF-Worker-Job: ${(job as PdfJob).type}`),
      );
  }
};
