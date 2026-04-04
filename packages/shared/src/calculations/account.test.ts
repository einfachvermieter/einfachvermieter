import { describe, expect, it } from "vitest";
import { computeStatus } from "../schemas/tenant-account.js";
import { makePot } from "./account.js";

describe("computeStatus - laufende Miete (positive Sollwerte)", () => {
  it("Ist = Soll -> balanced", () => {
    expect(computeStatus(80_000, 80_000)).toBe("balanced");
  });

  it("Ist < Soll -> open (Mieter schuldet)", () => {
    expect(computeStatus(80_000, 50_000)).toBe("open");
  });

  it("Ist > Soll -> credit (Mieter überzahlt)", () => {
    expect(computeStatus(80_000, 90_000)).toBe("credit");
  });

  it("kein Eingang -> open", () => {
    expect(computeStatus(80_000, 0)).toBe("open");
  });
});

describe("computeStatus - NK-Saldo (negative Sollwerte = Vermieter schuldet)", () => {
  it("Erstattung in Höhe der Schuld -> balanced", () => {
    expect(computeStatus(-10_000, -10_000)).toBe("balanced");
  });

  it("noch nicht erstattet -> open", () => {
    expect(computeStatus(-10_000, 0)).toBe("open");
  });

  it("teilweise erstattet -> open", () => {
    expect(computeStatus(-10_000, -4000)).toBe("open");
  });

  it("zu viel erstattet -> credit", () => {
    expect(computeStatus(-10_000, -15_000)).toBe("credit");
  });
});

describe("computeStatus - Soll = 0 (z. B. keine Kaution vereinbart)", () => {
  it("kein Eingang, kein Soll -> balanced", () => {
    expect(computeStatus(0, 0)).toBe("balanced");
  });

  it("Eingang ohne Soll -> credit", () => {
    expect(computeStatus(0, 5000)).toBe("credit");
  });
});

describe("makePot - aggregiert Ist-Liste, ermittelt Status", () => {
  it("leere Ist-Liste mit positivem Soll -> open mit ist=0", () => {
    const pot = makePot(80_000, []);
    expect(pot).toEqual({ sollCents: 80_000, istCents: 0, status: "open" });
  });

  it("mehrere Teilzahlungen summieren auf Soll -> balanced", () => {
    const pot = makePot(80_000, [30_000, 30_000, 20_000]);
    expect(pot).toEqual({
      sollCents: 80_000,
      istCents: 80_000,
      status: "balanced",
    });
  });

  it("signierte Bewegungen (Eingang + Storno) ergeben Netto-Ist", () => {
    const pot = makePot(80_000, [80_000, -80_000]);
    expect(pot).toEqual({ sollCents: 80_000, istCents: 0, status: "open" });
  });

  it("Überzahlung -> credit", () => {
    const pot = makePot(80_000, [90_000]);
    expect(pot.status).toBe("credit");
    expect(pot.istCents).toBe(90_000);
  });
});
