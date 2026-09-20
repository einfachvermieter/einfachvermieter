import { beforeAll, describe, expect, it } from "vitest";
import { createI18n, type I18nInstance } from "./instance.js";
import { messageKey } from "./messageKey.js";
import { translateMessageKey } from "./translate.js";

describe("i18n instance", () => {
  let instance: I18nInstance;

  beforeAll(async () => {
    instance = await createI18n();
  });

  it("translates a simple key", () => {
    expect(instance.t("common.save")).toBe("Speichern");
  });

  it("interpolates ICU plurals", () => {
    expect(instance.t("validation.tooShort", { min: 1 })).toBe(
      "Mindestens 1 Zeichen",
    );
    expect(instance.t("validation.tooShort", { min: 3 })).toBe(
      "Mindestens 3 Zeichen",
    );
  });

  it("wählt bei der Rückwirkungs-Warnung Einzahl und Mehrzahl", () => {
    const key = "ui.statements.detail.finalizeDialog.advanceValidFromPast";
    expect(
      instance.t(key, {
        validFrom: "01.09.2026",
        count: 1,
        from: "September 2026",
        to: "September 2026",
      }),
    ).toContain("für September 2026 nachträglich");
    expect(
      instance.t(key, {
        validFrom: "01.06.2026",
        count: 4,
        from: "Juni 2026",
        to: "September 2026",
      }),
    ).toContain("für Juni 2026 bis September 2026 nachträglich");
  });

  it("formats money as EUR", () => {
    const result = instance.t("format.money", { amount: 1234.5 });
    expect(result).toContain("1.234,50");
    expect(result).toContain("\u20AC");
  });

  it("resolves a messageKey payload", () => {
    const raw = messageKey("validation.numberMin", { min: 10 });
    expect(translateMessageKey(instance, raw)).toBe("Muss mindestens 10 sein");
  });
});
