/**
 * Führt eine SQL-Anweisung in der Transaktion der Migration aus
 */
type RunSql = (
  sql: string,
  params?: unknown[],
) => Promise<Record<string, unknown>[]>;

type PeriodValues = {
  totalHeatEnergyKwh: number | null;
  districtHeatEmissionsKgPerYear: number | null;
  districtHeatPrimaryEnergyFactor: number | null;
};

type VersionRow = PeriodValues & {
  id: string;
  buildingId: string;
  validFrom: string;
  validTo: string | null;
};

const toNumberOrNull = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

const hasAnyValue = (values: PeriodValues): boolean =>
  values.totalHeatEnergyKwh !== null ||
  values.districtHeatEmissionsKgPerYear !== null ||
  values.districtHeatPrimaryEnergyFactor !== null;

const sameValues = (a: PeriodValues, b: PeriodValues): boolean =>
  a.totalHeatEnergyKwh === b.totalHeatEnergyKwh &&
  a.districtHeatEmissionsKgPerYear === b.districtHeatEmissionsKgPerYear &&
  a.districtHeatPrimaryEnergyFactor === b.districtHeatPrimaryEnergyFactor;

const describeValues = (values: PeriodValues): string =>
  `Gesamt-Wärmemenge ${values.totalHeatEnergyKwh ?? "leer"} kWh, ` +
  `Treibhausgasemissionen ${values.districtHeatEmissionsKgPerYear ?? "leer"} kg, ` +
  `Primärenergiefaktor ${values.districtHeatPrimaryEnergyFactor ?? "leer"}`;

/**
 * Übernimmt Gesamt-Wärmemenge und Fernwärme-Werte aus den Versionen der
 * Heizkosten-Konfiguration in `heating_period_values`: je Gebäude und
 * Zeitraum einer vorhandenen Abrechnung die Werte der Version, die am
 * ersten Tag des Zeitraums gilt. So rechnet jede offene Abrechnung nach
 * der Migration wie davor.
 *
 * Werte, zu denen es keine Abrechnung gibt, haben keinen belegten Zeitraum
 * und werden nicht übernommen, sondern nur protokolliert.
 *
 * Läuft als Code statt als ein SQL-Befehl, damit das Verfahren in allen
 * drei Dialekten gleich ist.
 */
export const transferHeatingPeriodValues = async (
  run: RunSql,
  log: (message: string) => void = console.warn,
): Promise<void> => {
  const versions: VersionRow[] = (
    await run(
      "select id, building_id, valid_from, valid_to, total_heat_energy_kwh, district_heat_emissions_kg_per_year, district_heat_primary_energy_factor from heating_settings",
    )
  ).map((row) => ({
    id: String(row.id),
    buildingId: String(row.building_id),
    validFrom: String(row.valid_from),
    validTo: row.valid_to === null ? null : String(row.valid_to),
    totalHeatEnergyKwh: toNumberOrNull(row.total_heat_energy_kwh),
    districtHeatEmissionsKgPerYear: toNumberOrNull(
      row.district_heat_emissions_kg_per_year,
    ),
    districtHeatPrimaryEnergyFactor: toNumberOrNull(
      row.district_heat_primary_energy_factor,
    ),
  }));

  // Nur Zeiträume vorhandener Gebäude: Eine verwaiste Abrechnung (möglich,
  // wo die Datenbank Fremdschlüssel früher nicht geprüft hat) darf die
  // Migration nicht am Fremdschlüssel der neuen Tabelle scheitern lassen.
  const periods = await run(
    "select distinct building_id, period_start, period_end from operating_cost_statements where building_id in (select id from buildings)",
  );

  const transferredVersionIds = new Set<string>();
  for (const period of periods) {
    const buildingId = String(period.building_id);
    const periodStart = String(period.period_start);
    const periodEnd = String(period.period_end);

    // Dieselbe Bedingung, mit der die Berechnung bisher die Version bestimmt
    const matching = versions.filter(
      (version) =>
        version.buildingId === buildingId &&
        version.validFrom <= periodStart &&
        (version.validTo === null || version.validTo >= periodStart),
    );
    const [first, ...others] = matching;
    if (!first) {
      continue;
    }

    // Überlappende Versionen sind beschädigter Bestand. Welche davon bisher
    // galt, ist nicht festgelegt; bei verschiedenen Werten wird nicht geraten.
    if (others.some((other) => !sameValues(first, other))) {
      log(
        `[Migration] Gebäude ${buildingId}, Zeitraum ${periodStart} bis ${periodEnd}: überlappende Versionen der Heizkostenkonfiguration mit verschiedenen Werten, nichts übernommen. ${matching
          .map(
            (version) =>
              `Gültig ab ${version.validFrom}: ${describeValues(version)}`,
          )
          .join("; ")}`,
      );
      for (const version of matching) {
        transferredVersionIds.add(version.id);
      }
      continue;
    }

    if (!hasAnyValue(first)) {
      continue;
    }

    await run(
      "insert into heating_period_values (id, building_id, period_start, period_end, total_heat_energy_kwh, district_heat_emissions_kg_per_year, district_heat_primary_energy_factor) values (?, ?, ?, ?, ?, ?, ?)",
      [
        crypto.randomUUID(),
        buildingId,
        periodStart,
        periodEnd,
        first.totalHeatEnergyKwh,
        first.districtHeatEmissionsKgPerYear,
        first.districtHeatPrimaryEnergyFactor,
      ],
    );
    for (const version of matching) {
      transferredVersionIds.add(version.id);
    }
  }

  for (const version of versions) {
    if (hasAnyValue(version) && !transferredVersionIds.has(version.id)) {
      log(
        `[Migration] Gebäude ${version.buildingId}, Heizkostenkonfiguration gültig ab ${version.validFrom}: Werte ohne Abrechnung nicht übernommen. ${describeValues(version)}. Tragen Sie die Werte an der Abrechnung des Zeitraums neu ein.`,
      );
    }
  }
};
