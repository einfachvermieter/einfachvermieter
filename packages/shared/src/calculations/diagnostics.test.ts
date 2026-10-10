import {
  createI18nSync,
  createTranslate,
  deTranslations,
} from "@einfachvermieter/i18n";
import { describe, expect, it } from "vitest";
import { formatWarningParams } from "../format.js";
import type { CalcWarning } from "../types/index.js";
import { formatWarningLabels, groupCalcWarnings } from "./diagnostics.js";

const translate = createTranslate(createI18nSync());

const nonMonotonic = (
  label: string,
  fromValue: string,
  toValue: string,
): CalcWarning => ({
  code: "readingNonMonotonic",
  params: {
    fromDate: "2025-12-31",
    toDate: "2026-01-01",
    label,
  },
  detail: { fromValue, toValue },
});

describe("groupCalcWarnings", () => {
  it("bündelt gleichartige Warnungen trotz unterschiedlicher Zählerstände", () => {
    const groups = groupCalcWarnings([
      nonMonotonic("HKV EG Bad", "667", "0"),
      nonMonotonic("HKV EG Diele", "75", "0"),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.labels).toEqual([
      { label: "HKV EG Bad", detail: { fromValue: "667", toValue: "0" } },
      { label: "HKV EG Diele", detail: { fromValue: "75", toValue: "0" } },
    ]);
  });

  it("trennt Warnungen mit unterschiedlichen Daten", () => {
    const later: CalcWarning = {
      ...nonMonotonic("HKV DG Bad", "182", "0"),
      params: {
        fromDate: "2026-06-30",
        toDate: "2026-07-01",
        label: "HKV DG Bad",
      },
    };

    expect(
      groupCalcWarnings([nonMonotonic("HKV EG Bad", "667", "0"), later]),
    ).toHaveLength(2);
  });
});

describe("formatWarningLabels", () => {
  it("hängt die eigenen Werte je Zähler über den Textbaustein an", () => {
    const [group] = groupCalcWarnings([
      nonMonotonic("HKV EG Bad", "667", "0"),
      nonMonotonic("HKV EG Diele", "75", "0"),
    ]);

    const labels = formatWarningLabels(
      group as NonNullable<typeof group>,
      (key, params) =>
        `${key}|${params.label}|${params.fromValue}|${params.toValue}`,
    );

    expect(labels).toEqual([
      "warnings.detail.readingNonMonotonic|HKV EG Bad|667|0",
      "warnings.detail.readingNonMonotonic|HKV EG Diele|75|0",
    ]);
  });

  it("nutzt das blanke Label, wenn keine eigenen Werte vorliegen", () => {
    const [group] = groupCalcWarnings([
      {
        code: "readingMissingAfter",
        params: { date: "2025-12-31", label: "Küche" },
      },
    ]);

    expect(
      formatWarningLabels(
        group as NonNullable<typeof group>,
        () => "nicht genutzt",
      ),
    ).toEqual(["Küche"]);
  });
});

describe("Warntexte und Bündelung", () => {
  it("kein Warntext nutzt das Label, das die Bündelung in die Betreff-Liste verschiebt", () => {
    const withLabel = Object.entries(deTranslations.warnings)
      .filter(
        ([, text]) => typeof text === "string" && text.includes("{label}"),
      )
      .map(([code]) => code);

    expect(withLabel).toEqual([]);
  });

  it("setzt bei fehlender Grenzablesung Wohnung und Datum ein und nennt den Zähler als Betroffenen", () => {
    const [group] = groupCalcWarnings([
      {
        code: "supplyBoundaryReadingMissing",
        params: {
          unit: "DG Wohnung",
          date: "2025-06-30",
          label: "Wärmemengenzähler DG",
          unitId: "unit-dg",
          meterId: "meter-dg",
          scope: "heating",
        },
      },
    ]) as [NonNullable<ReturnType<typeof groupCalcWarnings>[number]>];
    const message = translate("warnings.affected", {
      message: translate(
        `warnings.${group.code}`,
        formatWarningParams(group.params),
      ),
      labels: formatWarningLabels(group, translate).join(", "),
    });

    expect(message).toBe(
      "In Wohnung DG Wohnung ändert sich die zentrale Versorgung. Der abgelesene Zählerstand zum 30.06.2025 fehlt. Bitte erfassen Sie den Stand zur Umstellung, er wird nicht geschätzt. Betrifft: Wärmemengenzähler DG",
    );
  });
});
