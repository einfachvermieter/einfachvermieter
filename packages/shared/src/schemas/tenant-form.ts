import { messageKey } from "@einfachvermieter/i18n";
import { isValidIBAN } from "ibantools-germany";
import { z } from "zod";
import { centsToEurInput, parseEurToCents } from "../format.js";
import { ISO_DATE_REGEX } from "./common.js";
import type { TenantSaveDto } from "./tenants.js";

const isoDateOrEmpty = z
  .string()
  .regex(ISO_DATE_REGEX, messageKey("ui.form.dateFormat"))
  .or(z.literal(""));

const amountRegex = /^\d+([.,]\d{1,2})?$/u;

const rentRowSchema = z.object({
  startDate: isoDateOrEmpty,
  endDate: isoDateOrEmpty,
  monthlyBaseRentEuros: z
    .string()
    .regex(amountRegex, messageKey("ui.form.amountFormat")),
  monthlyAdvanceEuros: z
    .string()
    .regex(amountRegex, messageKey("ui.form.amountFormat"))
    .refine((value) => parseEurToCents(value) > 0, {
      message: messageKey("ui.tenant.validation.advanceRequired"),
    }),
  reductionReason: z.string().max(500),
});

const residentRowSchema = z.object({
  residentId: z.string().optional(),
  firstName: z.string().min(1, messageKey("ui.form.firstNameRequired")),
  lastName: z.string().min(1, messageKey("ui.form.lastNameRequired")),
  email: z
    .string()
    .email(messageKey("ui.tenant.validation.invalidEmail"))
    .or(z.literal("")),
  phone: z.string(),
  moveInDate: isoDateOrEmpty,
  moveOutDate: isoDateOrEmpty,
  isContractParty: z.boolean(),
});

const addressRowSchema = z.object({
  startDate: isoDateOrEmpty,
  endDate: isoDateOrEmpty,
  street: z.string().min(1, messageKey("ui.tenant.validation.streetRequired")),
  postalCode: z
    .string()
    .min(1, messageKey("ui.tenant.validation.postalCodeRequired")),
  city: z.string().min(1, messageKey("ui.tenant.validation.cityRequired")),
});

const bankAccountRowSchema = z
  .object({
    startDate: isoDateOrEmpty,
    endDate: isoDateOrEmpty,
    iban: z
      .string()
      .min(1, messageKey("ui.tenant.validation.ibanRequired"))
      .refine((iban) => isValidIBAN(iban.replace(/\s+/gu, "").toUpperCase()), {
        message: messageKey("ui.tenant.validation.invalidIban"),
      }),
    bic: z.string(),
    accountHolder: z
      .string()
      .min(1, messageKey("ui.tenant.validation.accountHolderRequired")),
    sepaEnabled: z.boolean(),
    mandateReference: z.string(),
    mandateSignedAt: isoDateOrEmpty,
  })
  .superRefine((data, ctx) => {
    if (!data.sepaEnabled) {
      return;
    }
    if (!data.mandateReference.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mandateReference"],
        message: messageKey("ui.tenant.validation.mandateReferenceRequired"),
      });
    }
    if (!data.mandateSignedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mandateSignedAt"],
        message: messageKey("ui.tenant.validation.mandateSignedAtRequired"),
      });
    }
  });

export const tenantFormSchema = z.object({
  unitId: z.string().min(1, messageKey("ui.form.unitRequired")),
  kind: z.enum(["private", "owner"]),
  startDate: z
    .string()
    .min(1, messageKey("ui.tenant.validation.startDateRequired")),
  endDate: isoDateOrEmpty,
  depositEuros: z
    .string()
    .regex(amountRegex, messageKey("ui.form.amountFormat")),
  notes: z.string(),
  residents: z
    .array(residentRowSchema)
    .min(1, messageKey("ui.form.residentRequired")),
  rents: z.array(rentRowSchema),
  bankAccounts: z.array(bankAccountRowSchema),
  addresses: z.array(addressRowSchema),
});

export type TenantFormValues = z.infer<typeof tenantFormSchema>;

const ISO_INFINITY = "9999-12-31";

const previousDay = (iso: string): string => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

const addDay = (iso: string): string => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

/**
 * Schließt aufeinanderfolgende Zeiträume so, dass sie sich nicht
 * überlappen: Jeder Eintrag endet am Tag vor dem nächsten, der letzte
 * bleibt offen. Ohne das lässt sich kein zweiter Eintrag anlegen. Der
 * bestehende läuft ja bis auf Weiteres, und ihn vorher zu verkürzen
 * risse eine Lücke in die Abdeckung.
 */
export const closeOpenPeriods = <
  T extends { startDate: string; endDate: string },
>(
  entries: T[],
  fallbackStart: string,
): T[] => {
  const sorted = [...entries].sort((left, right) =>
    (left.startDate || fallbackStart).localeCompare(
      right.startDate || fallbackStart,
    ),
  );

  return sorted.map((entry, index) => {
    const next = sorted[index + 1];
    if (!next) {
      return entry;
    }

    const nextStart = next.startDate || fallbackStart;
    const ownEnd = entry.endDate;
    if (ownEnd && ownEnd < nextStart) {
      return entry;
    }

    return { ...entry, endDate: previousDay(nextStart) };
  });
};

/**
 * Zieht die Zeiträume des Vertrags mit, wenn Beginn oder Ende verschoben
 * werden. Ohne das ist eine Verschiebung nicht möglich: Henne/Ei-Problem
 * mit Vertrag und Mietsätzen, Bewohnern und Bankverbindungen.
 */
export const applyContractPeriod = (
  values: TenantFormValues,
  period: { startDate: string; endDate: string },
): TenantFormValues => {
  const { startDate, endDate } = period;
  if (!startDate) {
    return { ...values, ...period };
  }

  const insidePeriod = (entry: { startDate: string; endDate: string }) =>
    !(
      (entry.endDate && entry.endDate < startDate) ||
      (endDate && entry.startDate && entry.startDate > endDate)
    );

  const clampPeriods = <T extends { startDate: string; endDate: string }>(
    entries: T[],
  ): T[] => {
    const kept = entries.filter(insidePeriod);

    // Leere Ränder bleiben leer: sie meinen ohnehin Vertragsbeginn bzw.
    // -ende und wandern damit von selbst mit.
    return kept.map((entry, index) => ({
      ...entry,
      startDate:
        entry.startDate && (index === 0 || entry.startDate < startDate)
          ? startDate
          : entry.startDate,
      endDate:
        entry.endDate &&
        (index === kept.length - 1 || (endDate && entry.endDate > endDate))
          ? endDate
          : entry.endDate,
    }));
  };

  const rents = values.rents.length > 0 ? clampPeriods(values.rents) : [];

  return {
    ...values,
    ...period,
    rents,
    bankAccounts: clampPeriods(values.bankAccounts),
    residents: values.residents.map((resident) => ({
      ...resident,
      moveInDate:
        resident.moveInDate && resident.moveInDate < startDate
          ? startDate
          : resident.moveInDate,
      moveOutDate:
        resident.moveOutDate && endDate && resident.moveOutDate > endDate
          ? endDate
          : resident.moveOutDate,
    })),
  };
};

const hasFullContractPartyCoverage = (
  residents: TenantFormValues["residents"],
  tenantStart: string,
  tenantEnd: string,
): boolean => {
  const intervals = residents
    .filter((resident) => resident.isContractParty)
    .map((resident) => ({
      start: resident.moveInDate || tenantStart,
      end: resident.moveOutDate || tenantEnd,
    }))
    .filter((interval) => interval.start <= interval.end)
    .sort((left, right) => left.start.localeCompare(right.start));

  if (intervals.length === 0) {
    return false;
  }

  const merged: { start: string; end: string }[] = [];
  for (const interval of intervals) {
    const last = merged.at(-1);
    if (last && interval.start <= addDay(last.end)) {
      if (interval.end > last.end) {
        last.end = interval.end;
      }
    } else {
      merged.push({ ...interval });
    }
  }

  return merged.some(
    (segment) => segment.start <= tenantStart && segment.end >= tenantEnd,
  );
};

/**
 * Findet alle Original-Indizes von Zeit-Intervallen, die sich mit
 * mindestens einem anderen Eintrag überlappen.
 * Fehlende Start-/End-Daten werden auf die Vertragsgrenzen gemappt.
 */
const findOverlapIndices = (
  rows: { startDate: string; endDate: string }[],
  tenantStart: string,
  tenantEnd: string,
): Set<number> => {
  const overlapping = new Set<number>();
  if (rows.length < 2) {
    return overlapping;
  }

  const intervals = rows.map((row) => ({
    start: row.startDate || tenantStart,
    end: row.endDate || tenantEnd,
  }));

  for (let i = 0; i < intervals.length; i++) {
    for (let j = i + 1; j < intervals.length; j++) {
      const a = intervals[i];
      const b = intervals[j];

      if (!(a && b)) {
        continue;
      }

      if (a.start <= b.end && b.start <= a.end) {
        overlapping.add(i);
        overlapping.add(j);
      }
    }
  }

  return overlapping;
};

/**
 * Prüft, ob die Mietsatz-Kette den Vertragszeitraum lückenlos abdeckt.
 * Voraussetzung: keine Überlappungen (separat geprüft) und keine
 * Outside-Tenant-Verstöße (separat geprüft).
 */
const isRentCoverageComplete = (
  rents: TenantFormValues["rents"],
  tenantStart: string,
  tenantEnd: string,
): boolean => {
  if (rents.length === 0) {
    return false;
  }

  const intervals = rents
    .map((rent) => ({
      start: rent.startDate || tenantStart,
      end: rent.endDate || tenantEnd,
    }))
    .sort((left, right) => left.start.localeCompare(right.start));

  const [first] = intervals;
  const last = intervals.at(-1);

  if (!(first && last)) {
    return false;
  }

  if (first.start !== tenantStart) {
    return false;
  }

  if (last.end !== tenantEnd) {
    return false;
  }

  for (let index = 1; index < intervals.length; index += 1) {
    const previous = intervals[index - 1];
    const current = intervals[index];

    if (!(previous && current)) {
      continue;
    }

    if (current.start !== addDay(previous.end)) {
      return false;
    }
  }

  return true;
};

const isResidentOutsideTenant = (
  resident: TenantFormValues["residents"][number],
  tenantStart: string,
  tenantEnd: string | "",
): boolean => {
  if (resident.moveInDate && resident.moveInDate < tenantStart) {
    return true;
  }
  if (resident.moveOutDate && tenantEnd && resident.moveOutDate > tenantEnd) {
    return true;
  }
  return false;
};

const isPeriodOutsideTenant = (
  period: { startDate: string; endDate: string },
  tenantStart: string,
  tenantEnd: string | "",
): boolean => {
  if (period.startDate && period.startDate < tenantStart) {
    return true;
  }
  if (period.endDate && tenantEnd && period.endDate > tenantEnd) {
    return true;
  }
  if (period.startDate && period.endDate && period.startDate > period.endDate) {
    return true;
  }
  return false;
};

export const tenantFormSchemaRefined = tenantFormSchema.superRefine(
  (data, ctx) => {
    if (!data.startDate) {
      return;
    }

    const tenantEnd = data.endDate || ISO_INFINITY;
    const tenantEndForCheck = data.endDate || "";

    // Bewohner: Outside-Tenant pro Eintrag markieren, damit die einzelne
    // Zeile in der UI hervorgehoben werden kann.
    let anyResidentOutside = false;
    data.residents.forEach((resident, index) => {
      if (
        isResidentOutsideTenant(resident, data.startDate, tenantEndForCheck)
      ) {
        anyResidentOutside = true;
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["residents", index],
          message: messageKey("ui.tenant.validation.residentOutsideTenant"),
        });
      }
    });

    if (
      !anyResidentOutside &&
      data.residents.length > 0 &&
      !hasFullContractPartyCoverage(data.residents, data.startDate, tenantEnd)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["residents"],
        message: messageKey("ui.tenant.validation.contractPartyCoverage"),
      });
    }

    if (data.kind !== "owner") {
      if (data.rents.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rents"],
          message: messageKey("ui.tenant.validation.rentRequired"),
        });
      } else {
        // Mietsätze: Outside-Tenant pro Eintrag markieren.
        let anyRentOutside = false;
        data.rents.forEach((rent, index) => {
          if (
            isPeriodOutsideTenant(
              { startDate: rent.startDate, endDate: rent.endDate },
              data.startDate,
              tenantEndForCheck,
            )
          ) {
            anyRentOutside = true;
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["rents", index],
              message: messageKey("ui.tenant.validation.rentOutsideTenant"),
            });
          }
        });

        if (!anyRentOutside) {
          // Überlappungen pro Eintrag markieren.
          const overlap = findOverlapIndices(
            data.rents,
            data.startDate,
            tenantEnd,
          );

          for (const index of overlap) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["rents", index],
              message: messageKey("ui.tenant.validation.rentOverlap"),
            });
          }

          // Coverage-Lücke nur prüfen, wenn keine Überlappungen gefunden wurden.
          if (
            overlap.size === 0 &&
            !isRentCoverageComplete(data.rents, data.startDate, tenantEnd)
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["rents"],
              message: messageKey("ui.tenant.validation.rentCoverage"),
            });
          }
        }
      }
    }

    // Bankverbindungen: Outside-Tenant pro Eintrag markieren.
    let anyBankAccountOutside = false;
    data.bankAccounts.forEach((account, index) => {
      if (
        isPeriodOutsideTenant(
          { startDate: account.startDate, endDate: account.endDate },
          data.startDate,
          tenantEndForCheck,
        )
      ) {
        anyBankAccountOutside = true;
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["bankAccounts", index],
          message: messageKey("ui.tenant.validation.bankAccountOutsideTenant"),
        });
      }
    });

    if (!anyBankAccountOutside) {
      // Überlappungen pro Eintrag markieren.
      const overlap = findOverlapIndices(
        data.bankAccounts,
        data.startDate,
        tenantEnd,
      );

      for (const index of overlap) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["bankAccounts", index],
          message: messageKey("ui.tenant.validation.bankAccountOverlap"),
        });
      }
    }

    // Abweichende Anschriften: Überlappung zwischen Einträgen verboten.
    // Bewusst KEIN Outside-Tenant-Check: Adressen vor Einzug bzw.
    // nach Auszug sind der Hauptzweck dieses Features.
    data.addresses.forEach((address, index) => {
      if (
        address.startDate &&
        address.endDate &&
        address.startDate > address.endDate
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["addresses", index, "endDate"],
          message: messageKey("ui.tenant.validation.endBeforeStart"),
        });
      }
    });

    const addressOverlap = findOverlapIndices(
      data.addresses,
      data.startDate,
      tenantEnd,
    );

    for (const index of addressOverlap) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["addresses", index],
        message: messageKey("ui.tenant.validation.addressOverlap"),
      });
    }
  },
);

export const tenantFormToDto = (values: TenantFormValues): TenantSaveDto => ({
  unitId: values.unitId,
  kind: values.kind,
  startDate: values.startDate,
  endDate: values.endDate || undefined,
  depositCents: parseEurToCents(values.depositEuros || "0"),
  notes: values.notes || undefined,
  residents: values.residents.map((resident) => ({
    residentId: resident.residentId,
    resident: {
      firstName: resident.firstName,
      lastName: resident.lastName,
      email: resident.email || undefined,
      phone: resident.phone || undefined,
    },
    moveInDate: resident.moveInDate || undefined,
    moveOutDate: resident.moveOutDate || undefined,
    isContractParty: resident.isContractParty,
  })),
  rents:
    values.kind === "owner"
      ? []
      : [...values.rents]
          .sort((a, b) =>
            (a.startDate || values.startDate).localeCompare(
              b.startDate || values.startDate,
            ),
          )
          .map((rent) => ({
            startDate: rent.startDate || null,
            endDate: rent.endDate || null,
            monthlyBaseRentCents: parseEurToCents(rent.monthlyBaseRentEuros),
            monthlyAdvanceCents: parseEurToCents(rent.monthlyAdvanceEuros),
            reductionReason: rent.reductionReason.trim() || null,
          })),
  bankAccounts: values.bankAccounts.map((bankAccount) => ({
    startDate: bankAccount.startDate || null,
    endDate: bankAccount.endDate || null,
    iban: bankAccount.iban,
    bic: bankAccount.bic || undefined,
    accountHolder: bankAccount.accountHolder,
    mandateReference: bankAccount.sepaEnabled
      ? bankAccount.mandateReference || undefined
      : null,
    mandateSignedAt: bankAccount.sepaEnabled
      ? bankAccount.mandateSignedAt || undefined
      : null,
  })),
  addresses: values.addresses.map((address) => ({
    startDate: address.startDate || null,
    endDate: address.endDate || null,
    street: address.street.trim(),
    postalCode: address.postalCode.trim(),
    city: address.city.trim(),
  })),
});

export const emptyTenantFormValues = (startDate: string): TenantFormValues => ({
  unitId: "",
  kind: "private",
  startDate,
  endDate: "",
  depositEuros: "",
  notes: "",
  residents: [],
  rents: [],
  bankAccounts: [],
  addresses: [],
});

export type TenantAggregateForForm = {
  tenant: {
    unitId: string;
    kind: "private" | "owner";
    startDate: string;
    endDate: string | null;
    depositCents: number;
    notes: string | null;
  };
  residents: {
    residentId: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    moveInDate: string | null;
    moveOutDate: string | null;
    isContractParty: boolean;
  }[];
  rents: {
    startDate: string | null;
    endDate: string | null;
    monthlyBaseRentCents: number;
    monthlyAdvanceCents: number;
    reductionReason: string | null;
  }[];
  bankAccounts: {
    startDate: string | null;
    endDate: string | null;
    iban: string;
    bic: string | null;
    accountHolder: string;
    mandateReference: string | null;
    mandateSignedAt: string | null;
  }[];
  addresses: {
    startDate: string | null;
    endDate: string | null;
    street: string;
    postalCode: string;
    city: string;
  }[];
};

export const tenantAggregateToFormValues = (
  aggregate: TenantAggregateForForm,
): TenantFormValues => ({
  unitId: aggregate.tenant.unitId,
  kind: aggregate.tenant.kind,
  startDate: aggregate.tenant.startDate,
  endDate: aggregate.tenant.endDate ?? "",
  depositEuros: centsToEurInput(aggregate.tenant.depositCents),
  notes: aggregate.tenant.notes ?? "",
  residents: aggregate.residents.map((resident) => ({
    residentId: resident.residentId,
    firstName: resident.firstName,
    lastName: resident.lastName,
    email: resident.email ?? "",
    phone: resident.phone ?? "",
    moveInDate: resident.moveInDate ?? "",
    moveOutDate: resident.moveOutDate ?? "",
    isContractParty: resident.isContractParty,
  })),
  rents: [...aggregate.rents]
    .sort((a, b) =>
      (a.startDate ?? aggregate.tenant.startDate).localeCompare(
        b.startDate ?? aggregate.tenant.startDate,
      ),
    )
    .map((rent) => ({
      // Leer heißt "ab Vertragsbeginn"; auffüllen würde die Kopplung an
      // den Vertrag kappen.
      startDate: rent.startDate ?? "",
      endDate: rent.endDate ?? "",
      monthlyBaseRentEuros: centsToEurInput(rent.monthlyBaseRentCents),
      monthlyAdvanceEuros: centsToEurInput(rent.monthlyAdvanceCents),
      reductionReason: rent.reductionReason ?? "",
    })),
  bankAccounts: aggregate.bankAccounts.map((bankAccount) => ({
    startDate: bankAccount.startDate ?? "",
    endDate: bankAccount.endDate ?? "",
    iban: bankAccount.iban,
    bic: bankAccount.bic ?? "",
    accountHolder: bankAccount.accountHolder,
    sepaEnabled: Boolean(
      bankAccount.mandateReference || bankAccount.mandateSignedAt,
    ),
    mandateReference: bankAccount.mandateReference ?? "",
    mandateSignedAt: bankAccount.mandateSignedAt ?? "",
  })),
  addresses: aggregate.addresses.map((address) => ({
    startDate: address.startDate ?? "",
    endDate: address.endDate ?? "",
    street: address.street,
    postalCode: address.postalCode,
    city: address.city,
  })),
});
