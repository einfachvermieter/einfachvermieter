/**
 * Geteilte Mechanik für alle Seed-Profile (minimal / demo / local).
 * Die Profil-Dateien deklarieren nur Daten und rufen `runSeed(...)`;
 * ORM-Init, Persistenz, Fixture-Spiegelung und Passwort-Hashing leben hier.
 */
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { EntityData, EntityManager, EntitySchema } from "@mikro-orm/core";
import {
  APP_SETTINGS_ID,
  AppSettingsSchema,
  BuildingSchema,
  ClimateFactorSchema,
  CostEntryAttachmentSchema,
  CostEntryItemSchema,
  CostEntrySchema,
  CostTypeSchema,
  ExternalHeatingEntrySchema,
  HeatingSettingSchema,
  hashPassword,
  initOrm,
  MeterCostTypeAssignmentSchema,
  MeterDifferenceComponentSchema,
  MeterGasFactorSchema,
  MeterReadingSchema,
  MeterSchema,
  OperatingCostStatementSchema,
  PaymentSchema,
  ResidentSchema,
  TenantBankAccountSchema,
  TenantRentSchema,
  TenantResidentSchema,
  TenantSchema,
  UnitSchema,
  UserSchema,
} from "../../src/index.js";

/**
 * Namens-Mapping auf die EntitySchemas, damit die `schema.X`-Referenzen
 * in den Seed-Profilen kompakt bleiben.
 */
export const schema = {
  // biome-ignore lint/style/useNamingConvention: Re-Export von const
  APP_SETTINGS_ID,
  appSettings: AppSettingsSchema,
  buildings: BuildingSchema,
  units: UnitSchema,
  residents: ResidentSchema,
  tenants: TenantSchema,
  tenantResidents: TenantResidentSchema,
  tenantRents: TenantRentSchema,
  tenantBankAccounts: TenantBankAccountSchema,
  users: UserSchema,
  costTypes: CostTypeSchema,
  climateFactors: ClimateFactorSchema,
  externalHeatingEntries: ExternalHeatingEntrySchema,
  heatingSettings: HeatingSettingSchema,
  meters: MeterSchema,
  meterDifferenceComponents: MeterDifferenceComponentSchema,
  meterGasFactors: MeterGasFactorSchema,
  meterCostTypeAssignments: MeterCostTypeAssignmentSchema,
  meterReadings: MeterReadingSchema,
  payments: PaymentSchema,
  costEntries: CostEntrySchema,
  costEntryItems: CostEntryItemSchema,
  costEntryAttachments: CostEntryAttachmentSchema,
  operatingCostStatements: OperatingCostStatementSchema,
};

export type Insert = <T extends object>(
  entitySchema: EntitySchema<T>,
  data: EntityData<T> | EntityData<T>[],
) => void;

const makeInsert =
  (em: EntityManager): Insert =>
  (entitySchema, data) => {
    const rows = Array.isArray(data) ? data : [data];
    for (const row of rows) {
      em.persist(em.create(entitySchema, row, { partial: true }));
    }
  };

// Verzeichnis-Auflösung relativ zur eigenen Lage (`scripts/seed/engine.ts`),
// nicht zur aufrufenden Profil-Datei.
const engineDir = dirname(fileURLToPath(import.meta.url));
const scriptsDir = resolve(engineDir, ".."); // packages/db/scripts
const repoRoot = resolve(scriptsDir, "../../.."); // Repo-Wurzel
const fixturesBaseDir = resolve(scriptsDir, "seed-fixtures");

/**
 * Uploads-Wurzel analog zu `apps/api/src/storage/storage.service.ts`:
 * `UPLOADS_DIR` (relativ -> repoRoot, absolut 1:1), Default `data/uploads`.
 */
const resolveUploadsDir = (): string => {
  const configured = process.env.UPLOADS_DIR || "data/uploads";
  return isAbsolute(configured) ? configured : resolve(repoRoot, configured);
};

export { hashPassword };

/**
 * Kopiert ein Beleg-/Logo-Fixture des aktiven Profils aus
 * `seed-fixtures/<profile>/<storageKey>` in den Uploads-Ordner unter
 * demselben `storageKey`, exakt der Pfad, den die API später erwartet.
 */
export type CopyFixture = (storageKey: string) => Promise<void>;

const makeCopyFixture =
  (profile: string): CopyFixture =>
  async (storageKey) => {
    const src = resolve(fixturesBaseDir, profile, storageKey);
    const dest = resolve(resolveUploadsDir(), storageKey);
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(src, dest);
  };

export type SeedContext = {
  insert: Insert;
  em: EntityManager;
  copyFixture: CopyFixture;
  hashPassword: typeof hashPassword;
};

/**
 * Rahmen für ein Seed-Profil: ORM hochfahren, EM forken, `body` mit den
 * Bausteinen ausführen, flushen und die Verbindung sauber schließen.
 * `profile` bestimmt zugleich das Fixture-Unterverzeichnis.
 */
export const runSeed = async (
  profile: string,
  body: (ctx: SeedContext) => Promise<void> | void,
): Promise<void> => {
  const orm = await initOrm();
  try {
    const em = orm.em.fork();
    await body({
      insert: makeInsert(em),
      em,
      copyFixture: makeCopyFixture(profile),
      hashPassword,
    });
    await em.flush();
  } finally {
    await orm.close(true);
  }
};

/**
 * Einheitlicher Fehler-Exit für die ausführbaren Profil-Dateien.
 */
export const runSeedAsScript = (run: Promise<void>): void => {
  run.catch((_err) => {
    process.exit(1);
  });
};
