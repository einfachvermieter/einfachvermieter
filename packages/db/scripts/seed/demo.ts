/**
 * Seed-Profil `demo`: synthetischer, breit angelegter Datenbestand zum
 * Durchklicken (lokal oder für eine Demo-Website). Deckt bewusst mehrere
 * Gebäude mit unterschiedlichen Heizungskonfigurationen ab:
 *
 *   A "Lindenhof"   - interne Zentralheizung OHNE Warmwasser, Gas,
 *                     Verbrauch über Heizkostenverteiler, Gradtagszahlen,
 *                     Kaltwasser mit virtuellem Differenzzähler, Mieterwechsel.
 *   B "Gartenstadt" - interne Zentralheizung MIT Warmwasser, Öl, Verbrauch
 *                     über Wärmemengenzähler, lineare Abgrenzung,
 *                     Gewerbeeinheit.
 *   C "Seeblick"    - externe Wärmelieferung (Fernwärme), App rechnet die
 *                     Heizkosten nicht selbst, sondern übernimmt
 *                     external_heating_entries.
 *
 * Alle Beträge in Cent. Belege sind Platzhalter-PDFs aus
 * `seed-fixtures/demo/`. IDs werden pro Lauf neu erzeugt.
 *
 * Aufruf: npm run seed:demo -w @einfachvermieter/db
 */
import { runSeed, runSeedAsScript, schema } from "./engine.js";

const nid = (): string => crypto.randomUUID();

/**
 * Monatliche Kaltmiete + NK-Vorauszahlung von `fromMonth` bis `toMonth`
 * (je "YYYY-MM", inklusive). Bewusst nicht bis zum aktuellen Monat, damit
 * ein bis zwei jüngste Monate offen bleiben.
 */
const monthlyRentPayments = (
  tenantId: string,
  fromMonth: string,
  toMonth: string,
  baseRentCents: number,
  advanceCents: number,
) => {
  const [startYear, startMonth] = fromMonth.split("-").map(Number);
  const [endYear, endMonth] = toMonth.split("-").map(Number);
  const count = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
  return Array.from({ length: Math.max(count, 0) }, (_value, index) => {
    const monthIndex = startMonth - 1 + index;
    const year = startYear + Math.floor(monthIndex / 12);
    const paddedMonth = String((monthIndex % 12) + 1).padStart(2, "0");
    return {
      id: nid(),
      tenantId,
      paymentDate: `${year}-${paddedMonth}-03`,
      forMonth: `${year}-${paddedMonth}`,
      baseRentCents,
      advanceCents,
    };
  });
};

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: linearer Seed-Daten-Builder (mehrere Gebäude), kein Logik-Zerlegungsbedarf.
const main = runSeed("demo", async ({ insert, copyFixture, hashPassword }) => {
  // ── Globale Einstellungen + Login ──────────────────────────────────────
  const demoLogoStorageKey = "settings/sender-logo.svg";
  insert(schema.appSettings, {
    id: schema.APP_SETTINGS_ID,
    senderName: "Muster Hausverwaltung",
    senderAddressStreet: "Verwaltungsweg 1",
    senderAddressPostalCode: "45127",
    senderAddressCity: "Essen",
    senderEmail: "kontakt@muster-hausverwaltung.example",
    senderPhone: "0201 1234567",
    senderBankName: "Sparkasse Musterstadt",
    senderBankIban: "DE02500105170137075030",
    senderBankBic: "SPMUDE3MXXX",
    useLogo: true,
    logoStorageKey: demoLogoStorageKey,
    logoMimeType: "image/svg+xml",
  });
  await copyFixture(demoLogoStorageKey);

  insert(schema.users, {
    email: "demo@einfachvermieter.local",
    passwordHash: await hashPassword("demo"),
    role: "admin",
  });

  // ════════════════════════════════════════════════════════════════════════
  // Gebäude A - "Lindenhof 4", Essen
  // Interne Zentralheizung ohne Warmwasser, Gas, HKV, Differenzzähler Wasser.
  // ════════════════════════════════════════════════════════════════════════
  const aBuilding = nid();
  insert(schema.buildings, {
    id: aBuilding,
    name: "Lindenhof 4",
    addressStreet: "Lindenhof 4",
    addressPostalCode: "45127",
    addressCity: "Essen",
  });

  const aUnitEg = nid();
  const aUnitOg = nid();
  insert(schema.units, [
    {
      id: aUnitEg,
      buildingId: aBuilding,
      name: "EG links",
      unitNumber: "1",
      areaSqm: 72.5,
      heatingAreaSqm: 70.0,
    },
    {
      id: aUnitOg,
      buildingId: aBuilding,
      name: "OG rechts",
      unitNumber: "2",
      areaSqm: 95.0,
      heatingAreaSqm: 92.0,
    },
  ]);

  // Kostenarten A
  const aCtGas = nid();
  const aCtFreshWater = nid();
  const aCtWasteWater = nid();
  const aCtLandTax = nid();
  const aCtRefuse = nid();
  const aCtInsurance = nid();
  const aCtChimney = nid();
  const aCtCommonPower = nid();
  const aCtCable = nid();
  insert(schema.costTypes, [
    {
      id: aCtGas,
      buildingId: aBuilding,
      name: "Heizung (Gas)",
      category: "heating",
      defaultAllocationKey: null,
      co2Tracked: true,
    },
    {
      id: aCtFreshWater,
      buildingId: aBuilding,
      name: "Frischwasser",
      category: "operating",
      defaultAllocationKey: "per_consumption_m3",
    },
    {
      id: aCtWasteWater,
      buildingId: aBuilding,
      name: "Schmutzwasser",
      category: "operating",
      defaultAllocationKey: "per_consumption_m3",
    },
    {
      id: aCtLandTax,
      buildingId: aBuilding,
      name: "Grundsteuer",
      category: "operating",
      defaultAllocationKey: "per_living_area",
    },
    {
      id: aCtRefuse,
      buildingId: aBuilding,
      name: "Müllabfuhr",
      category: "operating",
      defaultAllocationKey: "per_living_area",
    },
    {
      id: aCtInsurance,
      buildingId: aBuilding,
      name: "Gebäudeversicherung",
      category: "operating",
      defaultAllocationKey: "per_living_area",
    },
    {
      id: aCtChimney,
      buildingId: aBuilding,
      name: "Schornsteinfeger",
      category: "operating",
      defaultAllocationKey: "per_unit",
    },
    {
      id: aCtCommonPower,
      buildingId: aBuilding,
      name: "Allgemeinstrom",
      category: "operating",
      defaultAllocationKey: "per_living_area",
    },
    {
      id: aCtCable,
      buildingId: aBuilding,
      name: "Kabel-TV (Gruppenvertrag)",
      category: "operating",
      defaultAllocationKey: "fixed",
    },
  ]);

  insert(schema.heatingSettings, {
    id: nid(),
    buildingId: aBuilding,
    mode: "internal",
    baseSharePercent: 30,
    consumptionSharePercent: 70,
    baseMethod: "area",
    consumptionMethod: "heat_cost_allocator",
    prorationMethod: "degree_days",
    heatingType: "central_without_hot_water",
    fuelType: "gas",
    hotWaterMeterId: null,
    hotWaterSupplyTemperatureCelsius: 60,
    co2CostShareEnabled: true,
    validFrom: "2025-01-01",
    validTo: null,
  });

  // Zähler A
  const aMeterGas = nid();
  const aMeterWaterMain = nid();
  const aMeterWaterEg = nid();
  const aMeterWaterOgDiff = nid();
  const aHkvEgWohn = nid();
  const aHkvEgBad = nid();
  const aHkvOgWohn = nid();
  const aHkvOgSchlaf = nid();
  insert(schema.meters, [
    {
      id: aMeterGas,
      buildingId: aBuilding,
      unitId: null,
      type: "gas",
      role: "main",
      label: "Gas Hauptzähler",
      serialNumber: "DEMO-A-GAS-001",
      measurementUnit: "m3",
      costAllocationMode: "heating_cost_bill",
      validFrom: "2025-01-01",
      isActive: true,
    },
    {
      id: aMeterWaterMain,
      buildingId: aBuilding,
      unitId: null,
      type: "water_cold",
      role: "main",
      label: "Kaltwasser Hauptzähler",
      serialNumber: "DEMO-A-KW-MAIN",
      measurementUnit: "m3",
      costAllocationMode: "cost_types",
      validFrom: "2025-01-01",
      isActive: true,
    },
    {
      id: aMeterWaterEg,
      buildingId: aBuilding,
      unitId: aUnitEg,
      type: "water_cold",
      role: "unit",
      label: "Kaltwasser Wohnungszähler EG",
      serialNumber: "DEMO-A-KW-EG",
      measurementUnit: "m3",
      costAllocationMode: "cost_types",
      validFrom: "2025-01-01",
      isActive: true,
    },
    // OG wird als virtueller Differenzzähler abgebildet: Hauptzähler − EG.
    {
      id: aMeterWaterOgDiff,
      buildingId: aBuilding,
      unitId: aUnitOg,
      type: "water_cold",
      role: "virtual_difference",
      label: "Kaltwasser Differenzzähler OG",
      serialNumber: null,
      measurementUnit: "m3",
      costAllocationMode: "cost_types",
      validFrom: "2025-01-01",
      isActive: true,
    },
    {
      id: aHkvEgWohn,
      buildingId: aBuilding,
      unitId: aUnitEg,
      type: "heat_cost_allocator",
      role: "unit",
      label: "Heizkostenverteiler EG Wohnzimmer",
      serialNumber: "DEMO-A-HKV-EG-WZ",
      measurementUnit: "units",
      room: "EG Wohnzimmer",
      costAllocationMode: "heating_cost_bill",
      kTotal: 1500,
      radiatorType: "Platten-HK",
      radiatorDimensions: "120x60",
      validFrom: "2025-01-01",
      isActive: true,
    },
    {
      id: aHkvEgBad,
      buildingId: aBuilding,
      unitId: aUnitEg,
      type: "heat_cost_allocator",
      role: "unit",
      label: "Heizkostenverteiler EG Bad",
      serialNumber: "DEMO-A-HKV-EG-BAD",
      measurementUnit: "units",
      room: "EG Bad",
      costAllocationMode: "heating_cost_bill",
      kTotal: 420,
      radiatorType: "Bad-HK",
      radiatorDimensions: "80x60",
      validFrom: "2025-01-01",
      isActive: true,
    },
    {
      id: aHkvOgWohn,
      buildingId: aBuilding,
      unitId: aUnitOg,
      type: "heat_cost_allocator",
      role: "unit",
      label: "Heizkostenverteiler OG Wohnzimmer",
      serialNumber: "DEMO-A-HKV-OG-WZ",
      measurementUnit: "units",
      room: "OG Wohnzimmer",
      costAllocationMode: "heating_cost_bill",
      kTotal: 1800,
      radiatorType: "Platten-HK",
      radiatorDimensions: "140x60",
      validFrom: "2025-01-01",
      isActive: true,
    },
    {
      id: aHkvOgSchlaf,
      buildingId: aBuilding,
      unitId: aUnitOg,
      type: "heat_cost_allocator",
      role: "unit",
      label: "Heizkostenverteiler OG Schlafzimmer",
      serialNumber: "DEMO-A-HKV-OG-SZ",
      measurementUnit: "units",
      room: "OG Schlafzimmer",
      costAllocationMode: "heating_cost_bill",
      kTotal: 1200,
      radiatorType: "Platten-HK",
      radiatorDimensions: "100x60",
      validFrom: "2025-01-01",
      isActive: true,
    },
  ]);

  insert(schema.meterDifferenceComponents, [
    {
      id: nid(),
      virtualMeterId: aMeterWaterOgDiff,
      sourceMeterId: aMeterWaterMain,
      kind: "base",
    },
    {
      id: nid(),
      virtualMeterId: aMeterWaterOgDiff,
      sourceMeterId: aMeterWaterEg,
      kind: "subtract",
    },
  ]);

  insert(schema.meterGasFactors, {
    id: nid(),
    meterId: aMeterGas,
    validFrom: "2025-01-01",
    validUntil: null,
    energyFactorKwhPerM3: 10.1,
  });

  insert(schema.meterCostTypeAssignments, [
    { meterId: aMeterWaterEg, costTypeId: aCtFreshWater },
    { meterId: aMeterWaterEg, costTypeId: aCtWasteWater },
    { meterId: aMeterWaterOgDiff, costTypeId: aCtFreshWater },
    { meterId: aMeterWaterOgDiff, costTypeId: aCtWasteWater },
  ]);

  insert(schema.meterReadings, [
    // Gas (m3) - Jahresverbrauch 1800 m3
    {
      id: nid(),
      meterId: aMeterGas,
      readingDate: "2025-01-01",
      value: 5000,
      readBy: "utility",
    },
    {
      id: nid(),
      meterId: aMeterGas,
      readingDate: "2025-12-31",
      value: 6800,
      readBy: "utility",
    },
    // Kaltwasser Hauptzähler (m3) - 150 m3
    {
      id: nid(),
      meterId: aMeterWaterMain,
      readingDate: "2025-01-01",
      value: 200,
      readBy: "utility",
    },
    {
      id: nid(),
      meterId: aMeterWaterMain,
      readingDate: "2025-12-31",
      value: 350,
      readBy: "utility",
    },
    // Kaltwasser EG (m3) - 60 m3 -> OG-Differenz = 90 m3
    {
      id: nid(),
      meterId: aMeterWaterEg,
      readingDate: "2025-01-01",
      value: 0,
      readBy: "landlord",
    },
    {
      id: nid(),
      meterId: aMeterWaterEg,
      readingDate: "2025-12-31",
      value: 60,
      readBy: "landlord",
    },
    // Heizkostenverteiler (Striche)
    {
      id: nid(),
      meterId: aHkvEgWohn,
      readingDate: "2025-01-01",
      value: 0,
      readBy: "metering_service",
    },
    {
      id: nid(),
      meterId: aHkvEgWohn,
      readingDate: "2025-12-31",
      value: 520,
      readBy: "metering_service",
    },
    {
      id: nid(),
      meterId: aHkvEgBad,
      readingDate: "2025-01-01",
      value: 0,
      readBy: "metering_service",
    },
    {
      id: nid(),
      meterId: aHkvEgBad,
      readingDate: "2025-12-31",
      value: 95,
      readBy: "metering_service",
    },
    {
      id: nid(),
      meterId: aHkvOgWohn,
      readingDate: "2025-01-01",
      value: 0,
      readBy: "metering_service",
    },
    {
      id: nid(),
      meterId: aHkvOgWohn,
      readingDate: "2025-12-31",
      value: 610,
      readBy: "metering_service",
    },
    {
      id: nid(),
      meterId: aHkvOgSchlaf,
      readingDate: "2025-01-01",
      value: 0,
      readBy: "metering_service",
    },
    {
      id: nid(),
      meterId: aHkvOgSchlaf,
      readingDate: "2025-12-31",
      value: 340,
      readBy: "metering_service",
    },
  ]);

  // Bewohner & Mietverträge A - EG mit Mieterwechsel zum 01.07.2025
  const aResWagner = nid();
  const aResKrueger = nid();
  const aResKruegerSabine = nid();
  const aResSchmidt = nid();
  insert(schema.residents, [
    { id: aResWagner, firstName: "Petra", lastName: "Wagner" },
    { id: aResKrueger, firstName: "Thomas", lastName: "Krüger" },
    { id: aResKruegerSabine, firstName: "Sabine", lastName: "Krüger" },
    { id: aResSchmidt, firstName: "Michael", lastName: "Schmidt" },
  ]);

  // EG: Altmieterin Wagner bis 30.06.2025
  const aTenantEgOld = nid();
  insert(schema.tenants, {
    id: aTenantEgOld,
    unitId: aUnitEg,
    kind: "private",
    startDate: "2022-05-01",
    endDate: "2025-06-30",
    depositCents: 150_000,
  });
  insert(schema.tenantResidents, {
    id: nid(),
    tenantId: aTenantEgOld,
    residentId: aResWagner,
  });
  insert(schema.tenantRents, {
    id: nid(),
    tenantId: aTenantEgOld,
    monthlyBaseRentCents: 68_000,
    monthlyAdvanceCents: 18_000,
  });
  insert(schema.tenantBankAccounts, {
    id: nid(),
    tenantId: aTenantEgOld,
    iban: "DE12500105170648489890",
    bic: "INGDDEFFXXX",
    accountHolder: "Petra Wagner",
  });

  // EG: Neumieter Krüger ab 01.07.2025
  const aTenantEgNew = nid();
  insert(schema.tenants, {
    id: aTenantEgNew,
    unitId: aUnitEg,
    kind: "private",
    startDate: "2025-07-01",
    depositCents: 210_000,
  });
  insert(schema.tenantResidents, [
    {
      id: nid(),
      tenantId: aTenantEgNew,
      residentId: aResKrueger,
      isContractParty: 1,
    },
    {
      id: nid(),
      tenantId: aTenantEgNew,
      residentId: aResKruegerSabine,
      isContractParty: 1,
    },
  ]);
  insert(schema.tenantRents, {
    id: nid(),
    tenantId: aTenantEgNew,
    monthlyBaseRentCents: 74_000,
    monthlyAdvanceCents: 20_000,
  });
  insert(schema.tenantBankAccounts, {
    id: nid(),
    tenantId: aTenantEgNew,
    iban: "DE75512108001245126199",
    bic: "COBADEFFXXX",
    accountHolder: "Thomas Krüger",
  });

  // OG: Familie Schmidt, durchgehend
  const aTenantOg = nid();
  insert(schema.tenants, {
    id: aTenantOg,
    unitId: aUnitOg,
    kind: "private",
    startDate: "2021-09-01",
    depositCents: 240_000,
  });
  insert(schema.tenantResidents, {
    id: nid(),
    tenantId: aTenantOg,
    residentId: aResSchmidt,
  });
  insert(schema.tenantRents, {
    id: nid(),
    tenantId: aTenantOg,
    monthlyBaseRentCents: 92_000,
    monthlyAdvanceCents: 24_000,
  });
  insert(schema.tenantBankAccounts, {
    id: nid(),
    tenantId: aTenantOg,
    iban: "DE89370400440532013000",
    bic: "DEUTDEMMXXX",
    accountHolder: "Michael Schmidt",
  });

  // Monatszahlungen: pro Mietverhältnis von Vertragsbeginn bis
  // 2026-05 durchbezahlt, damit die Konten überwiegend grün sind. Juni 2026
  // bleibt offen (amber), Juli 2026 ist der laufende Monat (neutral). Bei
  // Krüger sind bewusst zwei Monate (Mai+Juni) offen. Kaution des
  // langjährigen OG-Mieters ist eingegangen, die übrigen bleiben offen.
  insert(schema.payments, [
    ...monthlyRentPayments(aTenantEgOld, "2022-05", "2025-06", 68_000, 18_000),
    ...monthlyRentPayments(aTenantEgNew, "2025-07", "2026-04", 74_000, 20_000),
    ...monthlyRentPayments(aTenantOg, "2021-09", "2026-05", 92_000, 24_000),
    {
      id: nid(),
      tenantId: aTenantOg,
      paymentDate: "2021-09-05",
      forDeposit: true,
      amountCents: 240_000,
    },
  ]);

  // Rechnungen A
  const aGasEntry = nid();
  insert(schema.costEntries, {
    id: aGasEntry,
    invoiceDate: "2026-02-10",
    invoiceNumber: "GAS-2025-4471",
    vendor: "Stadtwerke Musterstadt",
  });
  const aGasStorageKey = "cost-entries/demo-stadtwerke-2025.pdf";
  insert(schema.costEntryItems, {
    id: nid(),
    costEntryId: aGasEntry,
    costTypeId: aCtGas,
    amountCents: 218_100,
    co2AmountGrams: 3_654_000,
    co2CostCents: 20_100,
    periodStart: "2025-01-01",
    periodEnd: "2025-12-31",
    position: 0,
  });
  insert(schema.costEntryAttachments, {
    id: nid(),
    costEntryId: aGasEntry,
    originalFilename: "Stadtwerke Gasrechnung 2025.pdf",
    mimeType: "application/pdf",
    sizeBytes: 682,
    storageKey: aGasStorageKey,
  });
  await copyFixture(aGasStorageKey);

  const aWaterEntry = nid();
  insert(schema.costEntries, {
    id: aWaterEntry,
    invoiceDate: "2026-01-20",
    invoiceNumber: "WAS-2025-9921",
    vendor: "Stadtwerke Musterstadt",
  });
  insert(schema.costEntryItems, [
    {
      id: nid(),
      costEntryId: aWaterEntry,
      costTypeId: aCtFreshWater,
      amountCents: 33_750,
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      position: 0,
    },
    {
      id: nid(),
      costEntryId: aWaterEntry,
      costTypeId: aCtWasteWater,
      amountCents: 41_250,
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      position: 1,
    },
  ]);

  const aCityEntry = nid();
  insert(schema.costEntries, {
    id: aCityEntry,
    invoiceDate: "2025-01-15",
    invoiceNumber: "ESS-2025-000123",
    vendor: "Stadt Musterstadt",
  });
  const aCityStorageKey = "cost-entries/demo-stadt-2025.pdf";
  insert(schema.costEntryItems, [
    {
      id: nid(),
      costEntryId: aCityEntry,
      costTypeId: aCtLandTax,
      amountCents: 52_000,
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      position: 0,
    },
    {
      id: nid(),
      costEntryId: aCityEntry,
      costTypeId: aCtRefuse,
      amountCents: 38_400,
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      position: 1,
    },
  ]);
  insert(schema.costEntryAttachments, {
    id: nid(),
    costEntryId: aCityEntry,
    originalFilename: "Stadt Abgabenbescheid 2025.pdf",
    mimeType: "application/pdf",
    sizeBytes: 678,
    storageKey: aCityStorageKey,
  });
  await copyFixture(aCityStorageKey);

  const aInsuranceEntry = nid();
  insert(schema.costEntries, {
    id: aInsuranceEntry,
    invoiceDate: "2024-11-05",
    invoiceNumber: "VS-2025-77310",
    vendor: "Muster Versicherung AG",
  });
  const aInsuranceStorageKey = "cost-entries/demo-versicherung-2025.pdf";
  insert(schema.costEntryItems, {
    id: nid(),
    costEntryId: aInsuranceEntry,
    costTypeId: aCtInsurance,
    amountCents: 61_200,
    periodStart: "2025-01-01",
    periodEnd: "2025-12-31",
    position: 0,
  });
  insert(schema.costEntryAttachments, {
    id: nid(),
    costEntryId: aInsuranceEntry,
    originalFilename: "Gebäudeversicherung Beitrag 2025.pdf",
    mimeType: "application/pdf",
    sizeBytes: 684,
    storageKey: aInsuranceStorageKey,
  });
  await copyFixture(aInsuranceStorageKey);

  const aMiscEntry = nid();
  insert(schema.costEntries, {
    id: aMiscEntry,
    invoiceDate: "2025-03-01",
    invoiceNumber: "DIV-2025-001",
    vendor: "Diverse",
  });
  insert(schema.costEntryItems, [
    {
      id: nid(),
      costEntryId: aMiscEntry,
      costTypeId: aCtChimney,
      amountCents: 9800,
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      position: 0,
    },
    {
      id: nid(),
      costEntryId: aMiscEntry,
      costTypeId: aCtCommonPower,
      amountCents: 14_400,
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      position: 1,
    },
    // Kabel-TV: fixed -> Direktzuordnung an die OG-Wohnung.
    {
      id: nid(),
      costEntryId: aMiscEntry,
      costTypeId: aCtCable,
      unitId: aUnitOg,
      amountCents: 18_000,
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      position: 2,
    },
  ]);

  // Abrechnungen A (Entwurf) - werden in der UI live berechnet.
  insert(schema.operatingCostStatements, [
    {
      id: nid(),
      buildingId: aBuilding,
      tenantId: aTenantOg,
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      documentDate: "2026-02-01",
      status: "draft",
    },
    {
      id: nid(),
      buildingId: aBuilding,
      tenantId: aTenantEgNew,
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      documentDate: "2026-02-01",
      status: "draft",
    },
  ]);

  // ════════════════════════════════════════════════════════════════════════
  // Gebäude B - "Gartenstadt 12", Bochum
  // Interne Zentralheizung mit Warmwasser, Öl, Wärmemengenzähler, Gewerbe.
  // ════════════════════════════════════════════════════════════════════════
  const bBuilding = nid();
  insert(schema.buildings, {
    id: bBuilding,
    name: "Gartenstadt 12",
    addressStreet: "Gartenstadt 12",
    addressPostalCode: "44801",
    addressCity: "Bochum",
  });

  const bUnitEg = nid();
  const bUnitOg = nid();
  const bUnitGewerbe = nid();
  insert(schema.units, [
    {
      id: bUnitEg,
      buildingId: bBuilding,
      name: "EG Wohnung",
      unitNumber: "1",
      areaSqm: 64.0,
      heatingAreaSqm: 62.0,
    },
    {
      id: bUnitOg,
      buildingId: bBuilding,
      name: "OG Wohnung",
      unitNumber: "2",
      areaSqm: 64.0,
      heatingAreaSqm: 62.0,
    },
    {
      id: bUnitGewerbe,
      buildingId: bBuilding,
      name: "Ladenlokal EG",
      unitNumber: "E1",
      areaSqm: 48.0,
      heatingAreaSqm: 46.0,
    },
  ]);

  const bCtHeatingOil = nid();
  const bCtFreshWater = nid();
  const bCtWasteWater = nid();
  const bCtLandTax = nid();
  const bCtCleaning = nid();
  const bCtInsurance = nid();
  insert(schema.costTypes, [
    {
      id: bCtHeatingOil,
      buildingId: bBuilding,
      name: "Heizung & Warmwasser (Öl)",
      category: "heating",
      defaultAllocationKey: null,
      co2Tracked: true,
    },
    {
      id: bCtFreshWater,
      buildingId: bBuilding,
      name: "Frischwasser",
      category: "operating",
      defaultAllocationKey: "per_consumption_m3",
    },
    {
      id: bCtWasteWater,
      buildingId: bBuilding,
      name: "Schmutzwasser",
      category: "operating",
      defaultAllocationKey: "per_consumption_m3",
    },
    {
      id: bCtLandTax,
      buildingId: bBuilding,
      name: "Grundsteuer",
      category: "operating",
      defaultAllocationKey: "per_living_area",
    },
    {
      id: bCtCleaning,
      buildingId: bBuilding,
      name: "Treppenhausreinigung",
      category: "operating",
      defaultAllocationKey: "per_living_area",
      laborCostCategory: "household_service",
    },
    {
      id: bCtInsurance,
      buildingId: bBuilding,
      name: "Gebäudeversicherung",
      category: "operating",
      defaultAllocationKey: "per_living_area",
    },
  ]);

  // Warmwasser-Wärmemengenzähler (für die § 9-Abspaltung referenziert).
  const bMeterHeatHotWater = nid();
  const bMeterHeatEg = nid();
  const bMeterHeatOg = nid();
  const bMeterHeatGewerbe = nid();
  const bMeterWaterMain = nid();
  const bMeterWaterEg = nid();
  const bMeterWaterOg = nid();
  const bMeterWaterGewerbe = nid();
  insert(schema.meters, [
    {
      id: bMeterHeatHotWater,
      buildingId: bBuilding,
      unitId: null,
      type: "heat_meter",
      role: "common",
      label: "Wärmemengenzähler Warmwasser",
      serialNumber: "DEMO-B-WMZ-WW",
      measurementUnit: "kwh",
      costAllocationMode: "heating_cost_bill",
      validFrom: "2025-01-01",
      isActive: true,
    },
    {
      id: bMeterHeatEg,
      buildingId: bBuilding,
      unitId: bUnitEg,
      type: "heat_meter",
      role: "unit",
      label: "Wärmemengenzähler EG",
      serialNumber: "DEMO-B-WMZ-EG",
      measurementUnit: "kwh",
      costAllocationMode: "heating_cost_bill",
      validFrom: "2025-01-01",
      isActive: true,
    },
    {
      id: bMeterHeatOg,
      buildingId: bBuilding,
      unitId: bUnitOg,
      type: "heat_meter",
      role: "unit",
      label: "Wärmemengenzähler OG",
      serialNumber: "DEMO-B-WMZ-OG",
      measurementUnit: "kwh",
      costAllocationMode: "heating_cost_bill",
      validFrom: "2025-01-01",
      isActive: true,
    },
    {
      id: bMeterHeatGewerbe,
      buildingId: bBuilding,
      unitId: bUnitGewerbe,
      type: "heat_meter",
      role: "unit",
      label: "Wärmemengenzähler Ladenlokal",
      serialNumber: "DEMO-B-WMZ-LAD",
      measurementUnit: "kwh",
      costAllocationMode: "heating_cost_bill",
      validFrom: "2025-01-01",
      isActive: true,
    },
    {
      id: bMeterWaterMain,
      buildingId: bBuilding,
      unitId: null,
      type: "water_cold",
      role: "main",
      label: "Kaltwasser Hauptzähler",
      serialNumber: "DEMO-B-KW-MAIN",
      measurementUnit: "m3",
      costAllocationMode: "cost_types",
      validFrom: "2025-01-01",
      isActive: true,
    },
    {
      id: bMeterWaterEg,
      buildingId: bBuilding,
      unitId: bUnitEg,
      type: "water_cold",
      role: "unit",
      label: "Kaltwasser EG",
      serialNumber: "DEMO-B-KW-EG",
      measurementUnit: "m3",
      costAllocationMode: "cost_types",
      validFrom: "2025-01-01",
      isActive: true,
    },
    {
      id: bMeterWaterOg,
      buildingId: bBuilding,
      unitId: bUnitOg,
      type: "water_cold",
      role: "unit",
      label: "Kaltwasser OG",
      serialNumber: "DEMO-B-KW-OG",
      measurementUnit: "m3",
      costAllocationMode: "cost_types",
      validFrom: "2025-01-01",
      isActive: true,
    },
    {
      id: bMeterWaterGewerbe,
      buildingId: bBuilding,
      unitId: bUnitGewerbe,
      type: "water_cold",
      role: "unit",
      label: "Kaltwasser Ladenlokal",
      serialNumber: "DEMO-B-KW-LAD",
      measurementUnit: "m3",
      costAllocationMode: "cost_types",
      validFrom: "2025-01-01",
      isActive: true,
    },
  ]);

  insert(schema.heatingSettings, {
    id: nid(),
    buildingId: bBuilding,
    mode: "internal",
    baseSharePercent: 30,
    consumptionSharePercent: 70,
    baseMethod: "area",
    consumptionMethod: "heat_meter",
    prorationMethod: "linear",
    heatingType: "central_with_hot_water",
    fuelType: "oil",
    hotWaterMeterId: bMeterHeatHotWater,
    hotWaterSupplyTemperatureCelsius: 60,
    totalHeatEnergyKwh: 42_000,
    co2CostShareEnabled: true,
    validFrom: "2025-01-01",
    validTo: null,
  });

  insert(schema.meterCostTypeAssignments, [
    { meterId: bMeterWaterEg, costTypeId: bCtFreshWater },
    { meterId: bMeterWaterEg, costTypeId: bCtWasteWater },
    { meterId: bMeterWaterOg, costTypeId: bCtFreshWater },
    { meterId: bMeterWaterOg, costTypeId: bCtWasteWater },
    { meterId: bMeterWaterGewerbe, costTypeId: bCtFreshWater },
    { meterId: bMeterWaterGewerbe, costTypeId: bCtWasteWater },
  ]);

  insert(schema.meterReadings, [
    // Wärmemengenzähler (kWh): Summe Einheiten 30.000, Warmwasser 8.000
    {
      id: nid(),
      meterId: bMeterHeatEg,
      readingDate: "2025-01-01",
      value: 0,
      readBy: "metering_service",
    },
    {
      id: nid(),
      meterId: bMeterHeatEg,
      readingDate: "2025-12-31",
      value: 11_000,
      readBy: "metering_service",
    },
    {
      id: nid(),
      meterId: bMeterHeatOg,
      readingDate: "2025-01-01",
      value: 0,
      readBy: "metering_service",
    },
    {
      id: nid(),
      meterId: bMeterHeatOg,
      readingDate: "2025-12-31",
      value: 12_500,
      readBy: "metering_service",
    },
    {
      id: nid(),
      meterId: bMeterHeatGewerbe,
      readingDate: "2025-01-01",
      value: 0,
      readBy: "metering_service",
    },
    {
      id: nid(),
      meterId: bMeterHeatGewerbe,
      readingDate: "2025-12-31",
      value: 6500,
      readBy: "metering_service",
    },
    {
      id: nid(),
      meterId: bMeterHeatHotWater,
      readingDate: "2025-01-01",
      value: 0,
      readBy: "metering_service",
    },
    {
      id: nid(),
      meterId: bMeterHeatHotWater,
      readingDate: "2025-12-31",
      value: 8000,
      readBy: "metering_service",
    },
    // Kaltwasser (m3)
    {
      id: nid(),
      meterId: bMeterWaterMain,
      readingDate: "2025-01-01",
      value: 0,
      readBy: "utility",
    },
    {
      id: nid(),
      meterId: bMeterWaterMain,
      readingDate: "2025-12-31",
      value: 175,
      readBy: "utility",
    },
    {
      id: nid(),
      meterId: bMeterWaterEg,
      readingDate: "2025-01-01",
      value: 0,
      readBy: "landlord",
    },
    {
      id: nid(),
      meterId: bMeterWaterEg,
      readingDate: "2025-12-31",
      value: 70,
      readBy: "landlord",
    },
    {
      id: nid(),
      meterId: bMeterWaterOg,
      readingDate: "2025-01-01",
      value: 0,
      readBy: "landlord",
    },
    {
      id: nid(),
      meterId: bMeterWaterOg,
      readingDate: "2025-12-31",
      value: 80,
      readBy: "landlord",
    },
    {
      id: nid(),
      meterId: bMeterWaterGewerbe,
      readingDate: "2025-01-01",
      value: 0,
      readBy: "landlord",
    },
    {
      id: nid(),
      meterId: bMeterWaterGewerbe,
      readingDate: "2025-12-31",
      value: 25,
      readBy: "landlord",
    },
  ]);

  const bResBecker = nid();
  const bResHoffmann = nid();
  const bResLaden = nid();
  insert(schema.residents, [
    { id: bResBecker, firstName: "Andrea", lastName: "Becker" },
    { id: bResHoffmann, firstName: "Jürgen", lastName: "Hoffmann" },
    { id: bResLaden, firstName: "Claudia", lastName: "Wolf" },
  ]);

  const bTenantEg = nid();
  insert(schema.tenants, {
    id: bTenantEg,
    unitId: bUnitEg,
    kind: "private",
    startDate: "2023-04-01",
    depositCents: 180_000,
  });
  insert(schema.tenantResidents, {
    id: nid(),
    tenantId: bTenantEg,
    residentId: bResBecker,
  });
  insert(schema.tenantRents, {
    id: nid(),
    tenantId: bTenantEg,
    monthlyBaseRentCents: 60_000,
    monthlyAdvanceCents: 19_000,
  });

  const bTenantOg = nid();
  insert(schema.tenants, {
    id: bTenantOg,
    unitId: bUnitOg,
    kind: "private",
    startDate: "2020-10-01",
    depositCents: 180_000,
  });
  insert(schema.tenantResidents, {
    id: nid(),
    tenantId: bTenantOg,
    residentId: bResHoffmann,
  });
  insert(schema.tenantRents, {
    id: nid(),
    tenantId: bTenantOg,
    monthlyBaseRentCents: 61_000,
    monthlyAdvanceCents: 19_000,
  });

  // Gewerbeeinheit (kind = commercial)
  const bTenantGewerbe = nid();
  insert(schema.tenants, {
    id: bTenantGewerbe,
    unitId: bUnitGewerbe,
    kind: "commercial",
    startDate: "2022-01-01",
    depositCents: 300_000,
    notes: "Friseursalon, Gewerbemietvertrag.",
  });
  insert(schema.tenantResidents, {
    id: nid(),
    tenantId: bTenantGewerbe,
    residentId: bResLaden,
  });
  insert(schema.tenantRents, {
    id: nid(),
    tenantId: bTenantGewerbe,
    monthlyBaseRentCents: 95_000,
    monthlyAdvanceCents: 22_000,
  });

  // Rechnungen B
  const bOilEntry = nid();
  insert(schema.costEntries, {
    id: bOilEntry,
    invoiceDate: "2025-09-12",
    invoiceNumber: "OEL-2025-3322",
    vendor: "Heizöl Musterland GmbH",
  });
  insert(schema.costEntryItems, {
    id: nid(),
    costEntryId: bOilEntry,
    costTypeId: bCtHeatingOil,
    amountCents: 312_000,
    co2AmountGrams: 7_900_000,
    co2CostCents: 43_500,
    periodStart: "2025-01-01",
    periodEnd: "2025-12-31",
    position: 0,
  });

  const bWaterEntry = nid();
  insert(schema.costEntries, {
    id: bWaterEntry,
    invoiceDate: "2026-01-22",
    invoiceNumber: "WAS-B-2025-55",
    vendor: "Stadtwerke Bochum",
  });
  insert(schema.costEntryItems, [
    {
      id: nid(),
      costEntryId: bWaterEntry,
      costTypeId: bCtFreshWater,
      amountCents: 39_375,
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      position: 0,
    },
    {
      id: nid(),
      costEntryId: bWaterEntry,
      costTypeId: bCtWasteWater,
      amountCents: 48_125,
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      position: 1,
    },
  ]);

  const bMiscEntry = nid();
  insert(schema.costEntries, {
    id: bMiscEntry,
    invoiceDate: "2025-02-01",
    invoiceNumber: "DIV-B-2025-1",
    vendor: "Diverse",
  });
  insert(schema.costEntryItems, [
    {
      id: nid(),
      costEntryId: bMiscEntry,
      costTypeId: bCtLandTax,
      amountCents: 44_000,
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      position: 0,
    },
    {
      id: nid(),
      costEntryId: bMiscEntry,
      costTypeId: bCtCleaning,
      amountCents: 28_800,
      laborCostsCents: 28_800,
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      position: 1,
    },
    {
      id: nid(),
      costEntryId: bMiscEntry,
      costTypeId: bCtInsurance,
      amountCents: 52_000,
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      position: 2,
    },
  ]);

  insert(schema.operatingCostStatements, {
    id: nid(),
    buildingId: bBuilding,
    tenantId: bTenantEg,
    periodStart: "2025-01-01",
    periodEnd: "2025-12-31",
    documentDate: "2026-02-01",
    status: "draft",
  });

  // ════════════════════════════════════════════════════════════════════════
  // Gebäude C - "Seeblick 5", Düsseldorf
  // Externe Wärmelieferung (Fernwärme): Heizkosten kommen 1:1 aus
  // external_heating_entries, die App rechnet sie nicht selbst.
  // ════════════════════════════════════════════════════════════════════════
  const cBuilding = nid();
  insert(schema.buildings, {
    id: cBuilding,
    name: "Seeblick 5",
    addressStreet: "Seeblick 5",
    addressPostalCode: "40210",
    addressCity: "Düsseldorf",
  });

  const cUnitEg = nid();
  const cUnitOg = nid();
  insert(schema.units, [
    {
      id: cUnitEg,
      buildingId: cBuilding,
      name: "EG",
      unitNumber: "1",
      areaSqm: 80.0,
      heatingAreaSqm: 78.0,
    },
    {
      id: cUnitOg,
      buildingId: cBuilding,
      name: "OG",
      unitNumber: "2",
      areaSqm: 80.0,
      heatingAreaSqm: 78.0,
    },
  ]);

  const cCtFreshWater = nid();
  const cCtWasteWater = nid();
  const cCtLandTax = nid();
  const cCtInsurance = nid();
  const cCtGardening = nid();
  insert(schema.costTypes, [
    {
      id: cCtFreshWater,
      buildingId: cBuilding,
      name: "Frischwasser",
      category: "operating",
      defaultAllocationKey: "per_consumption_m3",
    },
    {
      id: cCtWasteWater,
      buildingId: cBuilding,
      name: "Schmutzwasser",
      category: "operating",
      defaultAllocationKey: "per_consumption_m3",
    },
    {
      id: cCtLandTax,
      buildingId: cBuilding,
      name: "Grundsteuer",
      category: "operating",
      defaultAllocationKey: "per_living_area",
    },
    {
      id: cCtInsurance,
      buildingId: cBuilding,
      name: "Gebäudeversicherung",
      category: "operating",
      defaultAllocationKey: "per_living_area",
    },
    {
      id: cCtGardening,
      buildingId: cBuilding,
      name: "Gartenpflege",
      category: "operating",
      defaultAllocationKey: "per_living_area",
    },
  ]);

  insert(schema.heatingSettings, {
    id: nid(),
    buildingId: cBuilding,
    mode: "external",
    baseSharePercent: 30,
    consumptionSharePercent: 70,
    baseMethod: "area",
    consumptionMethod: "heat_meter",
    prorationMethod: "linear",
    heatingType: "central_with_hot_water",
    fuelType: "district_heat",
    hotWaterMeterId: null,
    hotWaterSupplyTemperatureCelsius: 60,
    co2CostShareEnabled: false,
    validFrom: "2025-01-01",
    validTo: null,
  });

  // Externe Heizkostenabrechnung des Wärmelieferanten je Wohnung.
  insert(schema.externalHeatingEntries, [
    {
      id: nid(),
      buildingId: cBuilding,
      unitId: cUnitEg,
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      totalCents: 142_000,
      baseCostCents: 42_600,
      consumptionCostCents: 99_400,
      notes: "Fernwärme-Jahresabrechnung 2025.",
    },
    {
      id: nid(),
      buildingId: cBuilding,
      unitId: cUnitOg,
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      totalCents: 158_500,
      baseCostCents: 42_600,
      consumptionCostCents: 115_900,
      notes: "Fernwärme-Jahresabrechnung 2025.",
    },
  ]);

  const cMeterWaterMain = nid();
  const cMeterWaterEg = nid();
  const cMeterWaterOg = nid();
  insert(schema.meters, [
    {
      id: cMeterWaterMain,
      buildingId: cBuilding,
      unitId: null,
      type: "water_cold",
      role: "main",
      label: "Kaltwasser Hauptzähler",
      serialNumber: "DEMO-C-KW-MAIN",
      measurementUnit: "m3",
      costAllocationMode: "cost_types",
      validFrom: "2025-01-01",
      isActive: true,
    },
    {
      id: cMeterWaterEg,
      buildingId: cBuilding,
      unitId: cUnitEg,
      type: "water_cold",
      role: "unit",
      label: "Kaltwasser EG",
      serialNumber: "DEMO-C-KW-EG",
      measurementUnit: "m3",
      costAllocationMode: "cost_types",
      validFrom: "2025-01-01",
      isActive: true,
    },
    {
      id: cMeterWaterOg,
      buildingId: cBuilding,
      unitId: cUnitOg,
      type: "water_cold",
      role: "unit",
      label: "Kaltwasser OG",
      serialNumber: "DEMO-C-KW-OG",
      measurementUnit: "m3",
      costAllocationMode: "cost_types",
      validFrom: "2025-01-01",
      isActive: true,
    },
  ]);

  insert(schema.meterCostTypeAssignments, [
    { meterId: cMeterWaterEg, costTypeId: cCtFreshWater },
    { meterId: cMeterWaterEg, costTypeId: cCtWasteWater },
    { meterId: cMeterWaterOg, costTypeId: cCtFreshWater },
    { meterId: cMeterWaterOg, costTypeId: cCtWasteWater },
  ]);

  insert(schema.meterReadings, [
    {
      id: nid(),
      meterId: cMeterWaterMain,
      readingDate: "2025-01-01",
      value: 0,
      readBy: "utility",
    },
    {
      id: nid(),
      meterId: cMeterWaterMain,
      readingDate: "2025-12-31",
      value: 130,
      readBy: "utility",
    },
    {
      id: nid(),
      meterId: cMeterWaterEg,
      readingDate: "2025-01-01",
      value: 0,
      readBy: "landlord",
    },
    {
      id: nid(),
      meterId: cMeterWaterEg,
      readingDate: "2025-12-31",
      value: 62,
      readBy: "landlord",
    },
    {
      id: nid(),
      meterId: cMeterWaterOg,
      readingDate: "2025-01-01",
      value: 0,
      readBy: "landlord",
    },
    {
      id: nid(),
      meterId: cMeterWaterOg,
      readingDate: "2025-12-31",
      value: 68,
      readBy: "landlord",
    },
  ]);

  const cResRichter = nid();
  const cResNeumann = nid();
  insert(schema.residents, [
    { id: cResRichter, firstName: "Stefan", lastName: "Richter" },
    { id: cResNeumann, firstName: "Birgit", lastName: "Neumann" },
  ]);

  const cTenantEg = nid();
  insert(schema.tenants, {
    id: cTenantEg,
    unitId: cUnitEg,
    kind: "private",
    startDate: "2024-06-01",
    depositCents: 250_000,
  });
  insert(schema.tenantResidents, {
    id: nid(),
    tenantId: cTenantEg,
    residentId: cResRichter,
  });
  insert(schema.tenantRents, {
    id: nid(),
    tenantId: cTenantEg,
    monthlyBaseRentCents: 99_000,
    monthlyAdvanceCents: 28_000,
  });

  const cTenantOg = nid();
  insert(schema.tenants, {
    id: cTenantOg,
    unitId: cUnitOg,
    kind: "private",
    startDate: "2019-03-01",
    depositCents: 250_000,
  });
  insert(schema.tenantResidents, {
    id: nid(),
    tenantId: cTenantOg,
    residentId: cResNeumann,
  });
  insert(schema.tenantRents, {
    id: nid(),
    tenantId: cTenantOg,
    monthlyBaseRentCents: 99_000,
    monthlyAdvanceCents: 30_000,
  });

  // Monatszahlungen B/C, gleiches Muster wie Gebäude A: bis 2026-05
  // durchbezahlt, Juni offen. Kautionen der langjährigen OG-Mieter eingegangen.
  insert(schema.payments, [
    ...monthlyRentPayments(bTenantEg, "2023-04", "2026-05", 60_000, 19_000),
    ...monthlyRentPayments(bTenantOg, "2020-10", "2026-05", 61_000, 19_000),
    ...monthlyRentPayments(
      bTenantGewerbe,
      "2022-01",
      "2026-05",
      95_000,
      22_000,
    ),
    ...monthlyRentPayments(cTenantEg, "2024-06", "2026-05", 99_000, 28_000),
    ...monthlyRentPayments(cTenantOg, "2019-03", "2026-05", 99_000, 30_000),
    {
      id: nid(),
      tenantId: bTenantOg,
      paymentDate: "2020-10-05",
      forDeposit: true,
      amountCents: 180_000,
    },
    {
      id: nid(),
      tenantId: cTenantOg,
      paymentDate: "2019-03-05",
      forDeposit: true,
      amountCents: 250_000,
    },
  ]);

  const cWaterEntry = nid();
  insert(schema.costEntries, {
    id: cWaterEntry,
    invoiceDate: "2026-01-30",
    invoiceNumber: "WAS-C-2025-7",
    vendor: "Stadtwerke Düsseldorf",
  });
  insert(schema.costEntryItems, [
    {
      id: nid(),
      costEntryId: cWaterEntry,
      costTypeId: cCtFreshWater,
      amountCents: 29_250,
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      position: 0,
    },
    {
      id: nid(),
      costEntryId: cWaterEntry,
      costTypeId: cCtWasteWater,
      amountCents: 35_750,
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      position: 1,
    },
  ]);

  const cMiscEntry = nid();
  insert(schema.costEntries, {
    id: cMiscEntry,
    invoiceDate: "2025-02-15",
    invoiceNumber: "DIV-C-2025-1",
    vendor: "Diverse",
  });
  insert(schema.costEntryItems, [
    {
      id: nid(),
      costEntryId: cMiscEntry,
      costTypeId: cCtLandTax,
      amountCents: 58_000,
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      position: 0,
    },
    {
      id: nid(),
      costEntryId: cMiscEntry,
      costTypeId: cCtInsurance,
      amountCents: 64_000,
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      position: 1,
    },
    {
      id: nid(),
      costEntryId: cMiscEntry,
      costTypeId: cCtGardening,
      amountCents: 21_600,
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      position: 2,
    },
  ]);

  insert(schema.operatingCostStatements, {
    id: nid(),
    buildingId: cBuilding,
    tenantId: cTenantEg,
    periodStart: "2025-01-01",
    periodEnd: "2025-12-31",
    documentDate: "2026-02-01",
    status: "draft",
  });

  // ════════════════════════════════════════════════════════════════════════
  // Gebäude D - "Ahornweg 3", Duisburg
  // Bewusst leer (keine Wohnungen/Mieter/Kostenarten): zeigt die Empty-States
  // von Wohnungen-, Mieter-, Zähler- und Kostenarten-Liste bei aktivem Gebäude.
  // ════════════════════════════════════════════════════════════════════════
  insert(schema.buildings, {
    id: nid(),
    name: "Ahornweg 3",
    addressStreet: "Ahornweg 3",
    addressPostalCode: "47051",
    addressCity: "Duisburg",
  });
});

runSeedAsScript(main);
