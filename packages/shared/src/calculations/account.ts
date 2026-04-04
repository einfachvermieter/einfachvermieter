/**
 * Mieterkonto: pure Funktionen zur Soll/Ist-Aggregation pro Topf.
 */

import { computeStatus, type PotState } from "../schemas/tenant-account.js";

/**
 * Erzeugt einen Topf aus einem Sollwert und einer Liste signierter
 * Ist-Bewegungen. Pure Funktion, hilfreich in Service und UI.
 */
export const makePot = (
  sollCents: number,
  istCentsList: number[],
): PotState => {
  const istCents = istCentsList.reduce((sum, value) => sum + value, 0);
  return {
    sollCents,
    istCents,
    status: computeStatus(sollCents, istCents),
  };
};
