export type Period = {
  start: string; // YYYY-MM-DD inklusiv
  end: string; // YYYY-MM-DD inklusiv
};

export type DiagnosticParams = Record<string, string | number>;

export type CalcWarning = {
  code: string;
  params?: DiagnosticParams;
};

export type UnitInfo = {
  id: string;
  name: string;
  areaSqm: number;
  heatingAreaSqm?: number | null;
  /**
   * Nur Anzeige. Für Umlagen `personDays` nutzen.
   */
  occupantCount: number;
  /**
   * Bewohner x überlappende Tage in der Periode.
   */
  personDays: number;
  /**
   * Tage mit aktivem Mietvertrag. Für Vermieter-/Leerstand-Anteil.
   */
  occupiedDays: number;
  /**
   * Summe HKVO-Gradtag-Promille über belegte Tage. Nur bei `prorationMethod = "degree_days"`.
   */
  occupiedDegreeDayPromille?: number;
  /**
   * Periodenlänge in Tagen; redundant, damit Allocation keine Period braucht.
   */
  periodDays: number;
  /**
   * Summe Gradtag-Promille über die volle Periode. Nenner bei `degree_days`.
   */
  periodDegreeDayPromille?: number;
};

export type MeterInfo = {
  id: string;
  type:
    | "electricity"
    | "water_cold"
    | "water_hot"
    | "gas"
    | "heat_meter"
    | "heat_cost_allocator";
  role: "main" | "unit" | "sub" | "common" | "virtual_difference";
  unitId: string | null;
  label: string;
  serialNumber?: string | null;
  measurementUnit: "m3" | "kwh" | "units";
  /**
   * Bewertungsfaktor KGesamt. Pflicht bei `heat_cost_allocator`. */
  kTotal?: number | null;
  /**
   * Gültigkeitsbereich (ISO). Berechnungen klemmen die Periode darauf;
   * Zählertausch = zwei überlappungsfreie Records.
   */
  validFrom: string;
  validUntil: string | null;
};

export type ReadingPoint = {
  date: string; // YYYY-MM-DD
  value: number;
  isCumulative: boolean;
  isEstimated: boolean;
};

export type CostEntry = {
  id: string;
  costTypeId: string;
  allocationKey:
    | "per_living_area"
    | "per_heating_area"
    | "per_person"
    | "per_unit"
    | "per_consumption_m3"
    | "per_consumption_kwh"
    | "heating_ordinance"
    | "fixed";
  name: string;
  amountCents: number;
  /**
   * Direktzuordnung an eine Wohnung. Nur bei `fixed`;
   * voller Betrag auf diese Wohnung.
   */
  unitId?: string | null;
  periodStart: string;
  periodEnd: string;
};

export type HeatingConfig = {
  /**
   * Verbrauchsanteil in Basispunkten, 7000 = 70%.
   */
  consumptionShareBps: number;
};

/**
 * Berechnungsergebnis einer Kostenposition
 * je Tenant (auf der Abrechnung angezeigt).
 */
export type CostLineResult = {
  /**
   * `cost_types.id`; für die zusammengefasste Heizzeile `STATEMENT_HEATING_COST_TYPE_ID`.
   */
  costTypeId: string;
  costTypeName: string;
  allocationKey: CostEntry["allocationKey"];
  /**
   * Gesamtbetrag der Kostenart (anteilig). */
  totalAmountCents: number;
  /**
   * Bemessungsgrundlage gesamt (z. B. 180 qm).
   */
  totalBase: number;
  /**
   * Bemessungsgrundlage des Tenants.
   */
  tenantBase: number;
  /**
   * Anteilsquote in Basispunkten (10000 = 100%).
   */
  shareBps: number;
  /**
   * Umgelegter Betrag auf den Tenant in Cent.
   */
  tenantAmountCents: number;
  baseUnit: string; // "qm", "Personen", "Wohnung", "m3", "kWh", "Pauschale"
  /**
   * Vermieter-Anteil (Cent) aus Leerstand bei zeitanteiliger Umlage.
   */
  landlordAmountCents: number;
  /**
   * Vermieter-Anteilsquote in Basispunkten.
   */
  landlordShareBps: number;
  /**
   * Klartext-Aufschlüsselung von `tenantBase` (z. B. "1 Person x 365 Tage").
   * Leer bei zusammengesetzten Werten; dann liefert der Belegungs-Anhang das Detail.
   */
  tenantBaseExplain?: string;
  /**
   * Analog für `totalBase`.
   */
  totalBaseExplain?: string;
  /**
   * Dreisatz-Felder: Gesamtkosten / bemessungTotal x bemessungTenant
   * [ / daysTotal x daysTenant ] = tenantAmount.
   * `days*` null bei Verbrauchsschlüsseln und `fixed`/`heating_ordinance`/`per_heating_area`.
   */
  bemessungTotal: number | null;
  bemessungTenant: number | null;
  bemessungUnit: string | null;
  daysTotal: number | null;
  daysTenant: number | null;
  notes?: string;
};

/**
 * Snapshot-Schemaversion; beim Finalisieren eingeschrieben. Hochzählen +
 * Migrations-Mapper nur bei inkompatibler Strukturänderung (Feld hinzufügen
 * reicht nicht). Alte Snapshots nie rückwirkend umschreiben.
 */
export const STATEMENT_RESULT_VERSION = 2 as const;

/**
 * Vorauszahlungs-Detail im `StatementResult` (auch in der Live-Preview befüllt).
 */
export type AdvanceAdjustmentDetail = {
  /**
   * Vereinbarte monatl. NK-Vorauszahlung (Cent) am Periodenende; beim Finalisieren eingefroren.
   */
  currentMonthlyAdvanceCents: number;
  /**
   * Vereinbarte monatl. Kaltmiete (Cent), selber `tenant_rents`-Eintrag.
   * 0 bei reinen NK-Vorauszahlungs-Verhältnissen.
   */
  currentMonthlyBaseRentCents: number;
  /**
   * Vorschlag: Periodenkosten auf 365 Tage / 12, auf volle Euro gerundet, ohne Tarif-Erwartung.
   */
  suggestedMonthlyAdvanceCents: number;
  /**
   * Wie oben, aber mit gespeicherten Tarif-Erwartungen; = Vorschlag, wenn `tariffAdjustmentBps` leer.
   */
  suggestedMonthlyAdvanceWithTariffsCents: number;
  /**
   * Mietzeit in der Periode (Tage). Divisor der Hochrechnung: Kosten sind bereits
   * auf diesen Zeitraum gerechnet, daher auf genau diese Tage aufs Jahr hoch.
   */
  tenantBilledDays: number;
  /**
   * Vom Vermieter festgelegte neue Vorauszahlung (Cent). `null` = keine Anpassung.
   */
  adjustedMonthlyAdvanceCents: number | null;
  /**
   * Stichtag für `adjustedMonthlyAdvanceCents`. Pflicht, wenn dieser gesetzt ist.
   */
  adjustedAdvanceValidFrom: string | null;
  /**
   * Erwartete Tarif-Anpassung je Kostenart in bps (100 = 1 %), `{ [costTypeId]: bps }`.
   * Speist `*WithTariffs` und den PDF-Hinweistext. Leer/`null` = keine Erwartung.
   */
  tariffAdjustmentBps: Record<string, number> | null;
  /**
   * Aus Folge-Rechnungen abgeleitete Tarif-Anpassung, nur zur Form-Vorbelegung
   * (nicht für Berechnung, dafür `tariffAdjustmentBps`). `null` = keine Daten.
   */
  autoTariffAdjustmentBps: Record<string, number> | null;
};

export type StatementResult = {
  /**
   * Snapshot-Schemaversion; immer gesetzt, auch in der Live-Preview.
   */
  version: number;
  tenantId: string;
  unitId: string;
  /**
   * Abrechnungsperiode; Bezug für Umlage und alle `daysTotal`.
   */
  period: Period;
  /**
   * Schnittmenge Mietvertrag x Periode. `daysTenant`, Verbrauchs-Extrapolation
   * und Vorauszahlungen; = `period` bei ganzjähriger Vermietung.
   */
  tenantPeriod: Period;
  lines: CostLineResult[];
  totalCostsCents: number;
  totalAdvancesCents: number;
  balanceCents: number;
  waterDetail?: WaterDetail;
  heatingDetail?: HeatingDetail;
  /**
   * Belegungs-Anhang (Personen-/Wohnungs-/Flächentage). Nur bei Leerstand gesetzt.
   */
  occupancyDetail?: OccupancyDetail;
  /**
   * Aggregierte Warnungen aller Subschritte. Erst in der API gefüllt, nicht in `calculateStatement`.
   */
  warnings?: string[];
  /**
   * Mieteingänge mit Zweck `month`, nach Monat sortiert. `totalAdvancesCents`
   * summiert `advanceCents`.
   */
  payments?: PaymentSummary[];
  /** Vorauszahlung, Vorschlag und Anpassung. Erst in der API ergänzt (Rentenlookup). */
  advanceAdjustment?: AdvanceAdjustmentDetail;
  /**
   * Umgelegte Lohnkosten nach § 35a EStG (Handwerker Abs. 3 / haushaltsnah Abs. 2),
   * Bescheinigung für die Steuererklärung. Erst in der API ergänzt.
   */
  taxableLaborCosts?: TaxableLaborCosts;
};

export type TaxableLaborCosts = {
  byCategory: Array<{
    category: "craftsman" | "household_service";
    /**
     * Summe tenantAmountCents der Kategorie.
     */
    tenantTotalCents: number;
    lines: Array<{
      costTypeId: string;
      costTypeName: string;
      /**
       * Anteilig dem Mieter zugerechneter Lohnkostenanteil (Cent).
       */
      tenantAmountCents: number;
    }>;
  }>;
};

export type PaymentSummary = {
  id: string;
  /**
   * Bei Zweck `month`: `YYYY-MM`.
   */
  forMonth: string;
  /**
   * Buchungsdatum.
   */
  date: string; // YYYY-MM-DD
  /**
   * Kaltmiet-Anteil (Cent).
   */
  baseRentCents: number;
  /**
   * NK-Voraus-Anteil (Cent).
   */
  advanceCents: number;
  reference: string | null;
};

export type WaterDetail = {
  totalConsumptionM3: number;
  perUnit: Array<{
    unitId: string;
    unitName: string;
    consumptionM3: number;
    sharePct: number;
    isDifferential: boolean;
    /**
     * Beitragende Zähler (PDF-Fußnote, nur ab 2 Beiträgen). Differenzzähler
     * erscheinen als ein Eintrag; ihre Formel wird nicht ausgewiesen (fremde Stände).
     */
    meterContributions: Array<{
      label: string;
      consumptionM3: number;
    }>;
  }>;
  /**
   * Verbrauch der Ziel-Wohnung außerhalb der Mietzeit (Vor-/Nachmieter,
   * Leerstand) fällt als Kostenanteil auf den Vermieter.
   */
  landlordConsumptionM3?: number;
  /**
   * Hinweise der Wasserberechnung (z. B. Stände decken Periode nicht ab).
   */
  warnings?: CalcWarning[];
};

/**
 * Belegungs-Anhang pro Wohnung. Bewohner anonym als "Person 1/2/…" (DSGVO);
 * macht die Personen-/Wohnungs-/Flächentage der CostsTable nachvollziehbar.
 */
export type OccupancyDetail = {
  periodDays: number;
  perUnit: Array<{
    unitId: string;
    unitName: string;
    /**
     * Wohnfläche (Flächentage = areaSqm x occupiedDays).
     */
    areaSqm: number;
    /**
     * Bewohner mit mind. einem Tag in der Periode.
     */
    occupantCount: number;
    /**
     * Tage mit aktivem Mietvertrag.
     */
    occupiedDays: number;
    /**
     * Summe Bewohner x überlappende Tage.
     */
    personDays: number;
    /**
     * Je Bewohner; Reihenfolge stabil, damit "Person 1" reproduzierbar dieselbe ist. */
    residents: Array<{
      label: string;
      from: string;
      to: string;
      days: number;
    }>;
  }>;
  /** S
   * umme Personentage inkl. Vermieter-Basisperson (1 x landlordOccupiedDays).
   */
  totalPersonDays: number;
  /**
   * Summe Wohnungstage; vs. (Wohnungen x periodDays) zeigt Leerstand.
   */
  totalOccupiedDays: number;
  /**
   * Vermieter-Wohnungstage: (Wohnungen x periodDays) − totalOccupiedDays. 0 bei Vollbelegung.
   */
  landlordOccupiedDays: number;
  /**
   * Vermieter-Personentage (= landlordOccupiedDays); eigenes Feld für klare Semantik.
   */
  landlordPersonDays: number;
};

export type HeatingDetail = {
  /**
   * Verteilter Netto-Topf (Brutto − Vermieter-CO2-Anteil). Immer
   * `consumptionPortionCents + basicPortionCents === totalHeatingCostsCents`.
   */
  totalHeatingCostsCents: number;
  /**
   * Heizungsanteil nach Warmwasser-Abspaltung (§ 9 Abs. 2 HeizkostenV). Immer
   * `consumptionPortionCents + basicPortionCents === heatingPotCents`.
   * Fehlt bei extern abgerechneter Heizung.
   */
  heatingPotCents?: number;
  consumptionShareBps: number;
  consumptionPortionCents: number;
  basicPortionCents: number;
  /**
   * Verteilter Zählertyp. Nur intern gesetzt.
   */
  consumptionMethod?: "heat_meter" | "heat_cost_allocator";
  /**
   * Verteilschlüssel des Verbrauchsanteils.
   * - "consumption":  nach gemessenem Verbrauch (Regelfall).
   * - "heating_area": Fallback nach (Heiz-)Fläche mangels Verbrauchsdaten (§ 9a).
   */
  consumptionDistributionMethod?: "consumption" | "heating_area";
  /**
   * Aufteilung teil-überlappender Positionen.
   * - "linear":      tagesproportional
   * - "degree_days": nach Gradtagstabelle der HeizkostenV
   * Nur intern gesetzt.
   */
  prorationMethod?: "linear" | "degree_days";
  /**
   * Hinweise der Berechnung (z. B. Flächen-Fallback).
   */
  warnings?: CalcWarning[];
  /**
   * Aufschlüsselung je Verbrauchsmesser (Stand-Delta, KGesamt, bewerteter Wert). Nur intern.
   */
  perMeter?: Array<{
    meterId: string;
    meterLabel: string;
    serialNumber: string | null;
    unitId: string | null;
    unitName: string | null;
    /**
     * Roher Verbrauch: WMZ = kWh-Delta, HKV = Anzeigewerte-Delta.
     */
    consumptionRaw: number;
    /**
     * Nur HKV: KGesamt-Faktor.
     */
    kTotal?: number | null;
    /**
     * Verteilter Wert: WMZ = consumptionRaw, HKV = consumptionRaw x kTotal.
     */
    consumptionWeighted: number;
  }>;
  perUnit: Array<{
    unitId: string;
    unitName: string;
    /**
     * Verbrauch: WMZ = kWh, HKV = bewertete Einheiten (Anzeige x KGesamt). Feldname bleibt generisch.
     */
    consumptionKwh: number;
    consumptionCostCents: number;
    areaSqm: number;
    basicCostCents: number;
    totalCents: number;
  }>;
  /**
   * Grundkosten-Anteil durch Leerstand auf den Vermieter. 0 bei Vollbelegung. Nur intern.
   */
  landlordBasicCostCents?: number;
  /**
   * Verbrauchskosten-Anteil auf den Vermieter, nur bei Heizflächen-Fallback. Nur intern.
   */
  landlordConsumptionCostCents?: number;
  /**
   * `true`, wenn eine Wohnung eine von `areaSqm` abweichende `heatingAreaSqm` hat.
   * Steuert den erläuternden PDF-Hinweis.
   */
  heatingAreaDiffersFromLivingArea?: boolean;
  /**
   * Brutto-Topf je Kostenart (absteigend nach Betrag). Summe ~= Brutto-Topf =
   * `totalHeatingCostsCents + (co2Detail?.landlordDeductionCents ?? 0)` (±1 Cent/Position).
   * Nur intern gesetzt.
   */
  costBreakdown?: Array<{
    label: string;
    amountCents: number;
  }>;
  /**
   * Energieträger (§ 6a HeizkostenV Pflichtangabe). Nur intern gesetzt.
   */
  fuelType?:
    | "gas"
    | "oil"
    | "district_heat"
    | "pellets"
    | "wood"
    | "electricity"
    | "heat_pump"
    | "other";
  /**
   * CO2KostAufG-Aufteilung (nur Wohngebäude). Gesetzt bei aktivierter Aufteilung
   * mit erfassten CO2-Kosten und -Menge; `landlordDeductionCents` ist bereits aus
   * `totalHeatingCostsCents` herausgerechnet. Fehlt die Menge -> `undefined` + Warnung.
   */
  co2Detail?: {
    /**
     * CO2-Kostenanteil im Topf (Cent), anteilig zur Periode.
     */
    totalCostCents: number;
    /**
     * CO2-Menge (Gramm), anteilig zur Periode.
     */
    totalAmountGrams: number;
    /**
     * Spezifischer Ausstoß in kg/qm x a.
     */
    emissionsKgPerSqmYear: number;
    /**
     * Vermieteranteil (%) aus dem 10-Stufen-Modell.
     */
    landlordSharePercent: number;
    /**
     * Vom Brutto-Topf abgezogener Vermieter-CO2-Anteil (Cent).
     */
    landlordDeductionCents: number;
  };
  /**
   * Warmwasser-Abspaltung nach § 9 Abs. 2 HeizkostenV. Gesetzt bei zentraler
   * WW-Bereitung mit erfolgreicher Abspaltung. Fehlt Q_WW/Q_gesamt -> `undefined`
   * + Warnung (alles zählt als Heizung).
   */
  hotWaterDetail?: {
    /**
     * Ermittlung Q_WW.
     * - "boiler_meter": am Boiler-WMZ gemessen (kWh-Delta).
     * - "estimated":    2,5 x V_WW x (t_WW − 10).
     */
    method: "boiler_meter" | "estimated";
    /**
     * Gesamt-Wärmemenge Q_gesamt (kWh), Nenner des Anteils.
     */
    totalHeatEnergyKwh: number;
    /**
     * Warmwasser-Wärmemenge Q_WW (kWh).
     */
    hotWaterHeatKwh: number;
    /**
     * Q_WW / Q_gesamt in Basispunkten.
     */
    hotWaterShareBps: number;
    /**
     * Abgespaltener Warmwasser-Topf (Cent).
     */
    hotWaterPotCents: number;
    /**
     * Nur `estimated`: angesetzte WW-Temperatur.
     */
    supplyTemperatureCelsius?: number;
    /**
     * Nur `estimated`: V_WW (m3).
     */
    hotWaterVolumeM3?: number;
    /**
     * Verbrauchsanteil des WW-Topfes in Basispunkten.
     */
    consumptionShareBps: number;
    consumptionPortionCents: number;
    basicPortionCents: number;
    /**
     * Verteilschlüssel des WW-Verbrauchsanteils.
     * - "consumption":  nach `water_hot`-Zählern.
     * - "heating_area": Fallback nach Wohnfläche.
     */
    consumptionDistributionMethod: "consumption" | "heating_area";
    perUnit: Array<{
      unitId: string;
      unitName: string;
      /**
       *  Warmwasserverbrauch (m3).
       */
      hotWaterM3: number;
      consumptionCostCents: number;
      areaSqm: number;
      basicCostCents: number;
      totalCents: number;
    }>;
    /**
     * Grundkosten-Anteil durch Leerstand auf den Vermieter.
     */
    landlordBasicCostCents: number;
    /**
     * Verbrauchskosten-Anteil auf den Vermieter (nur Flächen-Fallback).
     */
    landlordConsumptionCostCents: number;
  };
};
