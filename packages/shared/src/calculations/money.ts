/**
 * Verteilt einen Gesamtbetrag proportional auf Teile. Rundet jeden
 * Teil auf ganze Cent. Die Differenz zur Gesamtsumme (durch Rundung)
 * wird auf den größten Teil geschlagen, damit die Summe exakt passt.
 *
 * Wichtig für Abrechnungen: Die Einzelbeträge müssen sich auf den
 * Gesamtbetrag aufsummieren, sonst Bilanzfehler.
 */
export const distributeCents = (
  totalCents: number,
  weights: number[],
): number[] => {
  const weightSum = weights.reduce((acc, w) => acc + w, 0);
  if (weightSum === 0) {
    return weights.map(() => 0);
  }

  const raw = weights.map((w) => (totalCents * w) / weightSum);
  // Kaufmaennisch symmetrisch runden: -0,5 -> -1 (Math.round rundet zu 0),
  // sonst Halbcent-Bias sobald negative Betraege (Gutschriften) auftreten.
  const rounded = raw.map(
    (value) => Math.sign(value) * Math.round(Math.abs(value)),
  );
  const diff = totalCents - rounded.reduce((acc, v) => acc + v, 0);

  if (diff === 0) {
    return rounded;
  }

  // Verteile Rundungsdifferenz auf den Index mit größtem Gewicht
  let maxIdx = 0;
  let maxWeight = weights[0] ?? 0;
  for (let i = 1; i < weights.length; i++) {
    const w = weights[i] ?? 0;
    if (w > maxWeight) {
      maxWeight = w;
      maxIdx = i;
    }
  }

  rounded[maxIdx] = (rounded[maxIdx] ?? 0) + diff;

  return rounded;
};

/**
 * Basispunkte zu Prozent-Faktor (7000 bps -> 0,70).
 */
export const bpsToFactor = (bps: number): number => bps / 10_000;
