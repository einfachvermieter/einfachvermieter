import { messageKey } from "@einfachvermieter/i18n";
import { isValidIBAN } from "ibantools-germany";
import { z } from "zod";
import { isoDate } from "./common.js";
import { residentCreateSchema } from "./residents.js";

const tenantResidentInputSchema = z.object({
  residentId: z.guid().optional(),
  resident: residentCreateSchema,
  moveInDate: isoDate().optional().nullable(),
  moveOutDate: isoDate().optional().nullable(),
  isContractParty: z.boolean().default(true),
});
export type TenantResidentInput = z.infer<typeof tenantResidentInputSchema>;

const tenantRentInputSchema = z.object({
  startDate: isoDate().optional().nullable(),
  endDate: isoDate().optional().nullable(),
  monthlyBaseRentCents: z.number().int().min(0),
  /**
   * NK-Vorauszahlung pro Monat in Cent. Pauschalmiet-Verträge werden
   * nicht unterstützt (daher > 0)
   */
  monthlyAdvanceCents: z.number().int().positive(),
  reductionReason: z.string().max(500).optional().nullable(),
});
export type TenantRentInput = z.infer<typeof tenantRentInputSchema>;

const tenantBankAccountInputSchema = z.object({
  startDate: isoDate().optional().nullable(),
  endDate: isoDate().optional().nullable(),
  iban: z
    .string()
    .transform((s) => s.replace(/\s+/gu, "").toUpperCase())
    .pipe(
      z.string().refine((iban) => isValidIBAN(iban), {
        message: messageKey("ui.tenant.validation.invalidIban"),
      }),
    ),
  bic: z.string().max(20).optional().nullable(),
  accountHolder: z
    .string()
    .min(1, messageKey("ui.tenant.validation.accountHolderRequired"))
    .max(200),
  mandateReference: z.string().max(35).optional().nullable(),
  mandateSignedAt: isoDate().optional().nullable(),
});
export type TenantBankAccountInput = z.infer<
  typeof tenantBankAccountInputSchema
>;

const tenantAddressInputSchema = z.object({
  startDate: isoDate().optional().nullable(),
  endDate: isoDate().optional().nullable(),
  street: z
    .string()
    .min(1, messageKey("ui.tenant.validation.streetRequired"))
    .max(200),
  postalCode: z
    .string()
    .min(1, messageKey("ui.tenant.validation.postalCodeRequired"))
    .max(20),
  city: z
    .string()
    .min(1, messageKey("ui.tenant.validation.cityRequired"))
    .max(200),
});
export type TenantAddressInput = z.infer<typeof tenantAddressInputSchema>;

/**
 * Fügt einen Tag zu einem ISO-Datum hinzu (lokal, ohne Timezone-Tücken).
 * In den Shared Schemas nur hier verwendet.
 */
const addDaysIso = (date: string, days: number): string => {
  const parts = date.split("-");
  const dt = new Date(
    Date.UTC(
      Number.parseInt(parts[0] ?? "0", 10),
      Number.parseInt(parts[1] ?? "1", 10) - 1,
      Number.parseInt(parts[2] ?? "1", 10),
    ),
  );
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
};

/**
 * Vollständiger Speichervorgang eines Mietvertrags (Tenant) inklusive
 * Bewohner und Mietsätzen. API erwartet stets den kompletten
 * Aggregatzustand.
 */
const tenantSaveObject = z.object({
  unitId: z.guid(),
  kind: z.enum(["private", "commercial", "owner"]).default("private"),
  startDate: isoDate(),
  endDate: isoDate().optional().nullable(),
  /**
   * Vereinbarte Kaution in Cent. 0 = keine Kaution vereinbart.
   */
  depositCents: z.number().int().min(0).default(0),
  notes: z.string().max(1000).optional().nullable(),
  residents: z
    .array(tenantResidentInputSchema)
    .min(1, messageKey("ui.tenant.validation.residentRequired")),
  rents: z.array(tenantRentInputSchema),
  bankAccounts: z.array(tenantBankAccountInputSchema).default([]),
  addresses: z.array(tenantAddressInputSchema).default([]),
});
type TenantSaveData = z.infer<typeof tenantSaveObject>;

/**
 * Indizes von Perioden, die sich mit mindestens einer anderen überlappen.
 * Fehlende Start/End-Grenzen werden auf den übergebenen Fallback gemappt
 * (offene Periode = immer aktiv).
 */
const collectOverlapIndices = (
  periods: { startDate?: string | null; endDate?: string | null }[],
  fallbackStart: string,
  fallbackEnd: string,
): Set<number> => {
  const overlapping = new Set<number>();

  for (let i = 0; i < periods.length; i++) {
    for (let j = i + 1; j < periods.length; j++) {
      const a = periods[i];
      const b = periods[j];

      if (!(a && b)) {
        continue;
      }

      const aStart = a.startDate ?? fallbackStart;
      const aEnd = a.endDate ?? fallbackEnd;
      const bStart = b.startDate ?? fallbackStart;
      const bEnd = b.endDate ?? fallbackEnd;

      if (aStart <= bEnd && bStart <= aEnd) {
        overlapping.add(i);
        overlapping.add(j);
      }
    }
  }

  return overlapping;
};

/**
 * End- nach Startdatum, Vertragsfenster konsistent.
 */
const checkTenantDates = (data: TenantSaveData, ctx: z.RefinementCtx): void => {
  if (data.endDate && data.startDate > data.endDate) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: messageKey("ui.tenant.validation.endDateAfterStart"),
    });
  }
};

/**
 * Mindestens ein im Vertragszeitraum aktiver Bewohner und Einzug/Auszug
 * innerhalb der Vertragsgrenzen.
 */
const checkResidents = (data: TenantSaveData, ctx: z.RefinementCtx): void => {
  const hasActive = data.residents.some((r) => {
    const inStart = r.moveInDate ?? data.startDate;
    const tenantEnd = data.endDate ?? "9999-12-31";
    const residentOut = r.moveOutDate ?? tenantEnd;
    return inStart <= tenantEnd && residentOut >= data.startDate;
  });

  if (!hasActive) {
    ctx.addIssue({
      code: "custom",
      path: ["residents"],
      message: messageKey("ui.tenant.validation.residentActiveRequired"),
    });
  }

  // Einzug/Auszug der Bewohner muss innerhalb des Vertragszeitraums liegen.
  data.residents.forEach((r, i) => {
    if (r.moveInDate && r.moveInDate < data.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["residents", i, "moveInDate"],
        message: messageKey("ui.tenant.validation.moveInBeforeStart"),
      });
    }

    if (data.endDate && r.moveInDate && r.moveInDate > data.endDate) {
      ctx.addIssue({
        code: "custom",
        path: ["residents", i, "moveInDate"],
        message: messageKey("ui.tenant.validation.moveInAfterEnd"),
      });
    }

    if (r.moveOutDate && r.moveInDate && r.moveOutDate < r.moveInDate) {
      ctx.addIssue({
        code: "custom",
        path: ["residents", i, "moveOutDate"],
        message: messageKey("ui.tenant.validation.moveOutBeforeMoveIn"),
      });
    }

    if (data.endDate && r.moveOutDate && r.moveOutDate > data.endDate) {
      ctx.addIssue({
        code: "custom",
        path: ["residents", i, "moveOutDate"],
        message: messageKey("ui.tenant.validation.moveOutAfterEnd"),
      });
    }
  });
};

/**
 * Mietsatz-Regeln: Eigentümer ohne, sonst pflichtig; je Mietsatz die
 * Grenzen gegen den Vertragszeitraum. Die lückenlose Kette prüft
 */
const checkRents = (data: TenantSaveData, ctx: z.RefinementCtx): void => {
  const { rents } = data;

  if (data.kind === "owner") {
    if (rents.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["rents"],
        message: messageKey("ui.tenant.validation.ownerNoRents"),
      });
    }
    return;
  }

  if (rents.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["rents"],
      message: messageKey("ui.tenant.validation.rentRequired"),
    });
  }

  rents.forEach((r, i) => {
    if (r.startDate && r.startDate < data.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["rents", i, "startDate"],
        message: messageKey("ui.tenant.validation.rentStartBeforeTenantStart"),
      });
    }

    if (data.endDate && r.endDate && r.endDate > data.endDate) {
      ctx.addIssue({
        code: "custom",
        path: ["rents", i, "endDate"],
        message: messageKey("ui.tenant.validation.rentEndAfterTenantEnd"),
      });
    }

    if (r.startDate && r.endDate && r.startDate > r.endDate) {
      ctx.addIssue({
        code: "custom",
        path: ["rents", i, "endDate"],
        message: messageKey("ui.tenant.validation.endBeforeStart"),
      });
    }
  });

  checkRentChainCoverage(data, ctx);
};

/**
 * Die Mietsatz-Kette muss den Vertragszeitraum lückenlos abdecken: erster
 * Satz bei Vertragsbeginn, letzter bei -ende, keine Lücke dazwischen.
 */
const checkRentChainCoverage = (
  data: TenantSaveData,
  ctx: z.RefinementCtx,
): void => {
  const { rents } = data;
  const [first] = rents;

  if (!first) {
    return;
  }

  const firstStart = first.startDate ?? data.startDate;
  if (firstStart !== data.startDate) {
    ctx.addIssue({
      code: "custom",
      path: ["rents", 0, "startDate"],
      message: messageKey("ui.tenant.validation.firstRentAtTenantStart"),
    });
  }

  const last = rents.at(-1);
  if (last) {
    const lastEnd = last.endDate ?? data.endDate ?? null;
    const tenantEnd = data.endDate ?? null;
    if (lastEnd !== tenantEnd) {
      ctx.addIssue({
        code: "custom",
        path: ["rents", rents.length - 1, "endDate"],
        message: messageKey("ui.tenant.validation.lastRentAtTenantEnd"),
      });
    }
  }

  for (let i = 1; i < rents.length; i++) {
    const prev = rents[i - 1];
    const cur = rents[i];

    if (!(prev && cur)) {
      continue;
    }

    if (!prev.endDate) {
      ctx.addIssue({
        code: "custom",
        path: ["rents", i - 1, "endDate"],
        message: messageKey("ui.tenant.validation.rentEndDateMissing"),
      });

      continue;
    }

    if (!cur.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["rents", i, "startDate"],
        message: messageKey("ui.tenant.validation.startDateMissing"),
      });

      continue;
    }

    if (addDaysIso(prev.endDate, 1) !== cur.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["rents", i, "startDate"],
        message: messageKey("ui.tenant.validation.rentChainGap"),
      });
    }
  }
};

/**
 * Bankverbindungen: optional, aber zwei aktive Intervalle dürfen sich nicht
 * überlappen. Fehlende Start/End werden auf die Vertragsgrenzen gemappt
 * (offen = immer aktiv).
 */
const checkBankAccounts = (
  data: TenantSaveData,
  ctx: z.RefinementCtx,
): void => {
  const banks = data.bankAccounts;

  banks.forEach((b, i) => {
    if (b.startDate && b.endDate && b.startDate > b.endDate) {
      ctx.addIssue({
        code: "custom",
        path: ["bankAccounts", i, "endDate"],
        message: messageKey("ui.tenant.validation.endBeforeStart"),
      });
    }

    if (b.startDate && b.startDate < data.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["bankAccounts", i, "startDate"],
        message: messageKey(
          "ui.tenant.validation.bankAccountStartBeforeTenantStart",
        ),
      });
    }

    if (data.endDate && b.endDate && b.endDate > data.endDate) {
      ctx.addIssue({
        code: "custom",
        path: ["bankAccounts", i, "endDate"],
        message: messageKey(
          "ui.tenant.validation.bankAccountEndAfterTenantEnd",
        ),
      });
    }
  });

  const overlapping = collectOverlapIndices(
    banks,
    data.startDate,
    data.endDate ?? "9999-12-31",
  );

  for (const index of overlapping) {
    ctx.addIssue({
      code: "custom",
      path: ["bankAccounts", index],
      message: messageKey("ui.tenant.validation.bankAccountOverlap"),
    });
  }
};

/**
 * Abweichende Anschriften: pro Tenant 0..n; Perioden dürfen sich nicht
 * überlappen. Anders als Bankverbindungen DÜRFEN die Perioden vor
 * Vertragsbeginn liegen oder nach Vertragsende (Use-Case: Mieter noch
 * nicht eingezogen / schon ausgezogen).
 */
const checkAddresses = (data: TenantSaveData, ctx: z.RefinementCtx): void => {
  const { addresses } = data;

  addresses.forEach((a, i) => {
    if (a.startDate && a.endDate && a.startDate > a.endDate) {
      ctx.addIssue({
        code: "custom",
        path: ["addresses", i, "endDate"],
        message: messageKey("ui.tenant.validation.endBeforeStart"),
      });
    }
  });

  const overlapping = collectOverlapIndices(
    addresses,
    data.startDate,
    data.endDate ?? "9999-12-31",
  );

  for (const index of overlapping) {
    ctx.addIssue({
      code: "custom",
      path: ["addresses", index],
      message: messageKey("ui.tenant.validation.addressOverlap"),
    });
  }
};

export const tenantSaveSchema = tenantSaveObject.superRefine((data, ctx) => {
  checkTenantDates(data, ctx);
  checkResidents(data, ctx);
  checkRents(data, ctx);
  checkBankAccounts(data, ctx);
  checkAddresses(data, ctx);
});
export type TenantSaveDto = z.infer<typeof tenantSaveSchema>;
