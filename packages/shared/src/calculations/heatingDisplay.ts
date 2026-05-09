/**
 * Gemeinsames View-Model für die Heizkosten-Darstellung in Web-Karte und
 * PDF-Anlage (WYSIWYG-Pflicht: beide Renderer konsumieren dieselben
 * abgeleiteten Anzeigewerte, nur das Markup bleibt getrennt).
 */

export type LandlordShareRow = {
  consumptionCostCents: number;
  basicCostCents: number;
  totalCents: number;
};

/**
 * Vermieteranteil-Zeile der Verteilungstabellen (Heizung bzw. Warmwasser):
 * Grundkosten-Leerstand plus Verbrauch der Ziel-Wohnung außerhalb der
 * Mietzeit (Vor-/Nachmieter, Leerstand). null, wenn nichts auf den
 * Vermieter entfällt entfällt die Zeile.
 */
export const landlordShareRow = (detail: {
  landlordConsumptionCostCents?: number;
  landlordBasicCostCents?: number;
}): LandlordShareRow | null => {
  const consumptionCostCents = detail.landlordConsumptionCostCents ?? 0;
  const basicCostCents = detail.landlordBasicCostCents ?? 0;
  const totalCents = consumptionCostCents + basicCostCents;

  return totalCents > 0
    ? { consumptionCostCents, basicCostCents, totalCents }
    : null;
};
