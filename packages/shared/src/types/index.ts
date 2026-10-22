import type {
  SubstitutionBasisSource,
  SubstitutionMethod,
  SubstitutionReason,
  SubstitutionScope,
} from "../schemas/consumption-substitutions.js";
import type { HeatingBaseMethod } from "../schemas/heating.js";

export type Period = {
  start: string; // YYYY-MM-DD inklusiv
  end: string; // YYYY-MM-DD inklusiv
};

/**
 * Anteil eines Zeitraums am Jahr als gekürzter Bruch aus zwei ganzen Zahlen
 */
export type PeriodShare = { numerator: number; denominator: number };

export type DiagnosticParams = Record<string, string | number>;

export type CalcWarning = {
  code: string;
  params?: DiagnosticParams;
  detail?: DiagnosticParams;
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
   * Summe Gradtag-Promille über belegte Tage. Nur bei `prorationMethod = "degree_days"`.
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
  /**
   * Tage mit Versorgung aus der zentralen Anlage im gerade gerechneten
   * Bereich. Fehlt, wenn die Wohnung die ganze Periode versorgt ist.
   */
  suppliedDays?: number;
  /**
   * Summe Gradtag-Promille über die versorgten Tage
   */
  suppliedDegreeDayPromille?: number;
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
  /**
   * Stichtag `MM-TT`, an dem das Gerät die Zählung neu beginnt
   * (Heizkostenverteiler). `null` = der Zähler zählt durch.
   */
  resetDay?: string | null;
};

export type ReadingPoint = {
  date: string; // YYYY-MM-DD
  value: number;
  isCumulative: boolean;
  isEstimated: boolean;
  /**
   * Ausgleichsstand nach § 9a HeizkostenV: zur Laufzeit aus einem bereits
   * abgerechneten Ersatzverbrauch der Vorperiode gebildet, keine Ablesung.
   */
  compensation?: true;
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
  /**
   * Grundkostenmaßstab der maßgeblichen Version
   */
  baseMethod: HeatingBaseMethod;
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
  /**
   * Zähler der Ziel-Wohnung hinter dem Verbrauch dieser Zeile. Nur bei
   * m3-Kostenarten mit zugeordneten Zählern; sonst gelten die Zähler aus
   * `waterDetail`.
   */
  meterContributions?: Array<{ label: string; consumptionM3: number }>;
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
   * Tage des Abrechnungsjahres (365 / 366). Zähler der Hochrechnung,
   * damit die Live-Vorschau im Browser dasselbe rechnet wie der Server.
   */
  daysInBaseYear?: number;
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
   * Hinweise beim Ablesen der Zähler für die kWh-Umlage (z.B. geschätzter
   * Stand, fehlende Ablesung)
   */
  kwhWarnings?: CalcWarning[];
  /**
   * Betriebskosten, die sich mangels Verteilungsgrundlage auf niemanden
   * verteilen (Summe der Fläche 0)
   */
  costWarnings?: CalcWarning[];
  /**
   * Belegungs-Anhang (Personen-/Wohnungs-/Flächentage). Gesetzt bei Leerstand
   * oder wenn eine Personenumlage die Personentage-Gewichte erklären muss.
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
  /**
   * Vorauszahlung, Vorschlag und Anpassung. Erst in der API ergänzt (Rentenlookup).
   */
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
 * Belegungs-Anhang pro Wohnung. Bewohner anonym als "Person 1/2/..." (DSGVO);
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
     * Je Bewohner; Reihenfolge stabil, damit "Person 1" reproduzierbar dieselbe ist.
     */
    residents: Array<{
      label: string;
      from: string;
      to: string;
      days: number;
    }>;
  }>;
  /**
   * Summe Personentage inkl. Vermieter-Basisperson (1 x landlordOccupiedDays).
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
   * - "degree_days": nach Gradtagszahlen (§ 9b Abs. 2 HeizkostenV)
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
    /**
     * Mindestens einer der beiden Stichtagsstände wurde nicht direkt abgelesen.
     */
    consumptionIsDerived?: boolean;
    /**
     * Der Verbrauch ist ein Ersatzverbrauch nach § 9a HeizkostenV.
     */
    consumptionIsSubstituted?: boolean;
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
    /**
     * Der Verbrauch enthält einen Ersatzverbrauch nach § 9a HeizkostenV.
     */
    consumptionIsSubstituted?: boolean;
  }>;
  /**
   * Erfassungsausfälle nach § 9a HeizkostenV dieser Periode (Heizung und
   * Warmwasser), wie sie in die Berechnung eingegangen sind.
   */
  substitutions?: SubstitutionSnapshot[];
  /**
   * Ausgleichsstände aus Ersatzverbräuchen früherer Perioden, die in diese
   * Periode hineinwirken.
   */
  compensations?: CompensationSnapshot[];
  /**
   * Betroffene Fläche je Bereich für die 25-%-Grenze nach § 9a Abs. 2.
   */
  substitutionArea?: {
    heating?: SubstitutionAreaSnapshot;
    hotWater?: SubstitutionAreaSnapshot;
  };
  /**
   * Versorgung aus der zentralen Anlage je Wohnung, rein technisch ohne
   * Belegung. Alle Wohnungen des Gebäudes; nur gesetzt, wenn mindestens
   * eine nicht die ganze Periode versorgt war.
   */
  supply?: {
    heating?: SupplySnapshotRow[];
    hotWater?: SupplySnapshotRow[];
  };
  /**
   * Grund, wenn der Verbrauchsanteil nach Fläche verteilt wurde: fehlende
   * Messung (`fallback`) oder § 9a Abs. 2 (`substitution_limit_exceeded`).
   */
  areaDistributionReason?: AreaDistributionReason;
  /**
   * Grundkosten-Anteil durch Leerstand auf den Vermieter. 0 bei Vollbelegung. Nur intern.
   */
  landlordBasicCostCents?: number;
  /**
   * Verbrauchskosten-Anteil auf den Vermieter, nur bei Heizflächen-Fallback. Nur intern.
   */
  landlordConsumptionCostCents?: number;
  /**
   * Grundkostenmaßstab, mit dem gerechnet wurde. Bestimmt jeden Text, der
   * die Fläche benennt. Fehlt in alten Snapshots, dort gilt `heated_area`.
   */
  baseMethod?: HeatingBaseMethod;
  /**
   * `true`, wenn beim Maßstab `heated_area` eine Wohnung eine von `areaSqm`
   * abweichende `heatingAreaSqm` hat. Steuert den erläuternden PDF-Hinweis.
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
   * In den Heizkosten enthaltene Steuern, Abgaben und Zölle (§ 6a Abs. 3
   * Nr. 1b HeizkostenV), periodenanteilig. Nur gesetzt, wenn mindestens
   * eine Heiz-Position den Wert erfasst hat. Nur intern gesetzt.
   */
  containedTaxesCents?: number;
  /**
   * Arten der enthaltenen Steuern und Abgaben, aus den Heiz-Positionen der
   * Periode zusammengetragen. Nur gesetzt, wenn mindestens eine Position
   * eine Art nennt.
   */
  containedTaxKinds?: Array<
    "value_added_tax" | "energy_tax" | "co2_price" | "concession_fee" | "other"
  >;
  /**
   * Entgelte für Gebrauchsüberlassung/Eichung der Erfassungsgeräte sowie
   * Ablesung und Abrechnung (§ 6a Abs. 3 Nr. 1c HeizkostenV):
   * periodenanteilige Summe der als Erfassungs-/Abrechnungsentgelt
   * gekennzeichneten Heiz-Positionen. Nur intern gesetzt.
   */
  meteringServiceCostCents?: number;
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
   * Fernwärme-Kennwerte für die Abrechnungsinformationen nach § 6a Abs. 3
   * HeizkostenV. Nur bei `fuelType = "district_heat"` gesetzt; NULL-Werte =
   * in der Heizkonfiguration nicht erfasst (Warnung `districtHeatInfoMissing`).
   */
  districtHeatInfo?: {
    emissionsKgPerYear: number | null;
    primaryEnergyFactor: number | null;
  };
  /**
   * Abrechnungsmodus der Heizkosten.
   */
  mode: "internal" | "external";
  /**
   * True, wenn der Vermieter die § 6a-Informationsseite abgewählt hat
   */
  billingInfoOmitted: boolean;
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
     * Spezifischer Ausstoß in kg/qm x a. Nur beim vollen Jahr gesetzt, sonst
     * steht der Ausstoß in `emissionsKgPerSqmPeriod`. Snapshots aus der Zeit
     * der Hochrechnung tragen hier auch bei kurzem Zeitraum einen Jahreswert.
     */
    emissionsKgPerSqmYear?: number;
    /**
     * Spezifischer Ausstoß in kg/qm bezogen auf einen Abrechnungszeitraum
     * unter einem Jahr, gerundet auf eine Nachkommastelle. Mit diesem Wert
     * und `periodShare` wurde eingestuft.
     */
    emissionsKgPerSqmPeriod?: number;
    /**
     * Anteil des Abrechnungszeitraums am Jahr, um den die Grenzwerte der
     * Einstufung gekürzt sind. Nur bei einem Zeitraum unter einem Jahr.
     */
    periodShare?: PeriodShare;
    /**
     * Angewendeter Vermieteranteil (%), mit dem der Abzug gerechnet ist:
     * der Anteil aus dem 10-Stufen-Modell, mit einer Beschränkung nach § 9
     * CO2KostAufG dessen Hälfte (auch halbe Prozent) oder 0.
     */
    landlordSharePercent: number;
    /**
     * Vom Brutto-Topf abgezogener Vermieter-CO2-Anteil (Cent).
     */
    landlordDeductionCents: number;
    /**
     * Fläche, auf die der spezifische Ausstoß bezogen ist.
     */
    livingAreaSqm: number;
    /**
     * Berechnungsgrundlage je Brennstoffgruppe (Kostenart und
     * Emissionsfaktor), anteilig zur Periode. `null` = Angabe nicht erfasst.
     * Fehlt in älteren Snapshots.
     */
    fuelBasis?: Array<{
      label: string;
      energyKwh: number | null;
      emissionFactorKgPerKwh: number | null;
      amountGrams: number | null;
      costCents: number | null;
    }>;
    /**
     * Vermieteranteil (%) laut Stufe. Nur zusammen mit `restriction`
     * gesetzt.
     */
    tableLandlordSharePercent?: number;
    /**
     * Angaben des Vermieters zur Beschränkung nach § 9 CO2KostAufG. Nur
     * gesetzt, wenn Vorgaben dem Gebäude oder der Versorgung entgegenstehen.
     */
    restriction?: {
      building: boolean;
      supply: boolean;
      evidenceNote: string;
    };
  };
  /**
   * Warmwasser-Abspaltung nach § 9 Abs. 2 HeizkostenV. Gesetzt bei zentraler
   * WW-Bereitung mit erfolgreicher Abspaltung. Fehlt Q_WW/Q_gesamt -> `undefined`
   * + Warnung (alles zählt als Heizung).
   */
  hotWaterDetail?: {
    /**
     * Ermittlung Q_WW.
     * - "boiler_meter":       am Boiler-WMZ gemessen (kWh-Delta).
     * - "estimated":          2,5 x V_WW x (t_WW − 10).
     * - "flat_rate_fallback": wenn weder Boiler-WMZ noch Warmwasserverbrauch
     *                         vorliegen (32 kWh je qm Wohnfläche und Jahr)
     */
    method: "boiler_meter" | "estimated" | "flat_rate_fallback";
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
     * Angewendeter Korrekturfaktor nach § 9 Abs. 2 Satz 5 HeizkostenV
     * (brennwertbezogenes Erdgas, gewerbliche Wärmelieferung, monovalente
     * Wärmepumpe). Fehlt, wenn keiner greift oder Q_WW gemessen wurde.
     */
    correctionFactor?: number;
    /**
     * Verbrauchsanteil des WW-Topfes in Basispunkten.
     */
    consumptionShareBps: number;
    consumptionPortionCents: number;
    basicPortionCents: number;
    /**
     * Flächenmaßstab der Warmwasser-Grundkosten und von `perUnit.areaSqm`.
     * Fehlt in älteren Snapshots, dort steht in `areaSqm` die Heizfläche.
     */
    basicAreaBasis?: "living_area";
    /**
     * Verteilschlüssel des WW-Verbrauchsanteils.
     * - "consumption":  nach `water_hot`-Zählern.
     * - "heating_area": Fallback nach Wohnfläche.
     */
    consumptionDistributionMethod: "consumption" | "heating_area";
    /**
     * Grund der Flächenverteilung des Verbrauchsanteils, siehe Heizung.
     */
    areaDistributionReason?: AreaDistributionReason;
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
      /**
       * Der Warmwasserverbrauch enthält einen Ersatzverbrauch nach § 9a.
       */
      hotWaterIsSubstituted?: boolean;
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
  /**
   * Vorperiodenvergleich des witterungsbereinigten Energieverbrauchs
   */
  energyComparison?: EnergyComparison;
};

/**
 * Vergleichswerte für § 6a Abs. 3 Nr. 5 HeizkostenV: Energieverbrauch des
 * Mieters im aktuellen und im unmittelbar vorhergehenden Abrechnungszeitraum,
 * jeweils auf ein Normjahr umgerechnet (Heizung witterungsbereinigt über
 * Gradtagszahlen, Warmwasser tagesanteilig).
 */
export type EnergyComparison = {
  /**
   * Einheit beider Vergleichswerte: kWh (Wärmemengenzähler) oder bewertete
   * HKV-Einheiten. Warmwasser ist nur bei kWh enthalten.
   */
  consumptionUnit: "kwh" | "hkv_units";
  /**
   * `true`, wenn der Warmwasser-Energieanteil in beiden Werten enthalten ist.
   */
  includesHotWater: boolean;
  current: EnergyComparisonValue;
  /**
   * Fehlt, wenn es kein finalisiertes Statement desselben Mieters mit
   * unmittelbar vorausgehendem Zeitraum gibt oder dessen Verbrauch nicht
   * vergleichbar ist (andere Messmethode, kein gemessener Verbrauch).
   */
  previous?: EnergyComparisonValue;
};

export type EnergyComparisonValue = {
  /**
   * Nutzungszeitraum, aus dem der Verbrauch stammt.
   */
  period: Period;
  /**
   * Aufs Normjahr umgerechneter Verbrauch in `consumptionUnit`.
   */
  normalizedConsumption: number;
  /**
   * Klimafaktor (DWD bzw. manuell), mit dem der Heizanteil multipliziert
   * wurde. Fehlt, wenn keiner verfügbar war - dann ist der Wert nicht
   * witterungsbereinigt.
   */
  climateFactor?: number;
  /**
   * Der Faktor wurde manuell erfasst statt vom DWD geladen. Steuert die
   * Quellen-Angabe in der Fußnote.
   */
  climateFactorIsManual?: boolean;
  /**
   * Der Verbrauch enthält einen Ersatzverbrauch oder einen Ausgleich nach
   * § 9a HeizkostenV.
   */
  containsSubstitute?: boolean;
};

export type AreaDistributionReason = "fallback" | "substitution_limit_exceeded";

/**
 * Betroffene und gesamte Grundkostenfläche eines Bereichs
 */
export type SubstitutionAreaSnapshot = {
  affectedAreaSqm: number;
  totalAreaSqm: number;
  limitExceeded: boolean;
};

/**
 * Ein Erfassungsausfall, wie er abgerechnet wurde. `perMeter` ist
 * maßgeblich für den Ausgleich in späteren Perioden.
 */
export type SubstitutionSnapshot = {
  substitutionId: string;
  unitId: string;
  unitName: string;
  scope: SubstitutionScope;
  reason: SubstitutionReason;
  reasonNote?: string;
  method: SubstitutionMethod;
  basisSource: SubstitutionBasisSource;
  meterKeptCounting?: boolean;
  affectedAreaSqm: number;
  basis: {
    referencePeriod?: Period;
    referenceAffectedConsumption?: number;
    referenceTotalConsumption?: number;
    referenceShare?: number;
    comparisonUnitNames?: string[];
    comparisonConsumption?: number;
    comparisonAreaSqm?: number;
    ratePerSqm?: number;
    basisNote?: string;
  };
  perMeter: Array<{
    meterId: string;
    meterLabel: string;
    /**
     * Stand am Periodenanfang, mit dem gerechnet wurde. null bei Geräten
     * mit Stichtag oder ohne verwertbaren Anfangsstand.
     */
    periodStartValue: number | null;
    substituteConsumption: number;
  }>;
  substituteConsumption: number;
  /**
   * false, wenn § 9a Abs. 2 greift: dann wurde nach Fläche verteilt.
   */
  appliedToDistribution: boolean;
};

/**
 * Ein Ausgleichsstand, mit dem diese Periode gerechnet wurde
 */
export type CompensationSnapshot = {
  meterId: string;
  meterLabel: string;
  unitId: string;
  scope: SubstitutionScope;
  source: {
    period: Period;
    substitutionId: string;
    method: SubstitutionMethod;
    reason: SubstitutionReason;
    /**
     * Abrechnung, aus deren Snapshot der Ersatzverbrauch stammt. Fehlt, wenn
     * die Ausfallperiode noch nicht finalisiert ist.
     */
    fromSnapshotOfStatementId?: string;
  };
  periodStartValue: number;
  substituteConsumption: number;
  compensationValue: number;
  nextReading: { date: string; value: number } | null;
  /**
   * Nächster echter Stand minus Ausgleichsstand. null ohne nächsten Stand.
   */
  resultingConsumption: number | null;
};

export type SupplySnapshotRow = {
  unitId: string;
  unitName: string;
  suppliedDays: number;
  periodDays: number;
  suppliedPeriods: Period[];
};
