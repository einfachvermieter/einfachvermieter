import { describe, expect, it } from "vitest";
import { filenameFromHeader } from "./useStatementPdf";

describe("filenameFromHeader", () => {
  it("liest den einfachen Namen", () => {
    expect(
      filenameFromHeader('attachment; filename="NK-2025 EG Wohnung.pdf"'),
    ).toBe("NK-2025 EG Wohnung.pdf");
  });

  it("bevorzugt die kodierte Fassung mit Umlauten", () => {
    expect(
      filenameFromHeader(
        "attachment; filename=\"NK-2025.pdf\"; filename*=UTF-8''NK-2025%20Erdgescho%C3%9F%20(Entwurf).pdf",
      ),
    ).toBe("NK-2025 Erdgeschoß (Entwurf).pdf");
  });

  it("liefert leer, wenn nichts brauchbar ist", () => {
    expect(filenameFromHeader(null)).toBe("");
    expect(filenameFromHeader("attachment")).toBe("");
  });
});
