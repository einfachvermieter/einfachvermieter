import { createI18n } from "@einfachvermieter/i18n";
import { beforeAll, describe, expect, it } from "vitest";
import { setI18n } from "../i18n/i18n.registry.js";
import { statementPdfFilename } from "./pdf.service.js";
import { StatementsController } from "./statements.controller.js";

type Statement = {
  status: string;
  periodStart: string;
  periodEnd: string;
  sequenceNumber: number | null;
  revisionNumber: number | null;
  pdfPath: string | null;
  finalizedAt: string | null;
};

const draft: Statement = {
  status: "draft",
  periodStart: "2025-01-01",
  periodEnd: "2025-12-31",
  sequenceNumber: null,
  revisionNumber: null,
  pdfPath: null,
  finalizedAt: null,
};

const finalized: Statement = {
  ...draft,
  status: "finalized",
  sequenceNumber: 7,
  revisionNumber: 1,
};

/**
 * Ruft den PDF-Endpunkt mit Stubs für die Services auf und liefert die
 * gesetzten Antwort-Header zurück
 */
const callDownloadPdf = async (statement: Statement, download?: string) => {
  const headers: Record<string, string> = {};
  const controller = new StatementsController(
    { get: async () => statement } as never,
    {
      renderForStatement: async () => Buffer.from("%PDF-1.7"),
      filenameFor: async (row: Statement) =>
        statementPdfFilename(row, "OG rechts"),
    } as never,
    { read: async () => Buffer.from("%PDF-1.7") } as never,
  );

  await controller.downloadPdf(
    "statement-1",
    {
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
    } as never,
    download,
  );

  return headers;
};

describe("PDF-Download der Abrechnung", () => {
  beforeAll(async () => {
    setI18n(await createI18n());
  });

  it("liefert die Vorschau inline unter Jahr und Wohnung, solange die Abrechnung ein Entwurf ist", async () => {
    const headers = await callDownloadPdf(draft);

    expect(headers["Content-Disposition"]).toBe(
      "inline; filename*=UTF-8''NK-2025%20OG%20rechts%20(Entwurf).pdf",
    );
  });

  it("erzwingt mit download=1 den Download unter der Abrechnungsnummer", async () => {
    const headers = await callDownloadPdf(finalized, "1");

    expect(headers["Content-Disposition"]).toBe(
      "attachment; filename*=UTF-8''NK-2025-0007-01.pdf",
    );
  });

  it("behält die Abrechnungsnummer auch in der Inline-Vorschau", async () => {
    const headers = await callDownloadPdf(finalized);

    expect(headers["Content-Disposition"]).toBe(
      "inline; filename*=UTF-8''NK-2025-0007-01.pdf",
    );
  });

  it("lädt den Entwurf mit download=1 als Anhang herunter", async () => {
    const headers = await callDownloadPdf(draft, "1");

    expect(headers["Content-Disposition"]).toBe(
      "attachment; filename*=UTF-8''NK-2025%20OG%20rechts%20(Entwurf).pdf",
    );
  });

  it("hält Pfadtrenner aus dem Wohnungsnamen heraus", () => {
    expect(statementPdfFilename(draft, "EG links / Hinterhaus")).toBe(
      "NK-2025 EG links Hinterhaus (Entwurf).pdf",
    );
  });

  it("entfernt Steuer- und Formatzeichen aus dem Wohnungsnamen", () => {
    const rightToLeftOverride = "\u202e";
    const escapeChar = "\u001b";
    const unitName = `OG\u0000 rechts${escapeChar}${rightToLeftOverride}`;

    expect(statementPdfFilename(draft, unitName)).toBe(
      "NK-2025 OG rechts (Entwurf).pdf",
    );
  });

  it("entfernt führende und schließende Punkte des Wohnungsnamens", () => {
    expect(statementPdfFilename(draft, ".. Whg. 3.")).toBe(
      "NK-2025 Whg. 3 (Entwurf).pdf",
    );
  });

  it("kommt ohne verwertbaren Wohnungsnamen aus", () => {
    expect(statementPdfFilename(draft, "...")).toBe("NK-2025 (Entwurf).pdf");
  });

  it("lässt übliche Sonderzeichen im Wohnungsnamen stehen", () => {
    expect(statementPdfFilename(draft, "Dachgeschoss - Süd & Whg 1+2")).toBe(
      "NK-2025 Dachgeschoss - Süd & Whg 1+2 (Entwurf).pdf",
    );
  });
});
