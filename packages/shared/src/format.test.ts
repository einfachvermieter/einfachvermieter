import { describe, expect, it } from "vitest";
import { formatEur } from "./format.js";

describe("formatEur", () => {
  it("zeigt bei einer Null mit umgekehrtem Vorzeichen kein Minus", () => {
    expect(formatEur(-0)).toBe("0,00 €");
  });

  it("behält das Vorzeichen bei echten negativen Beträgen", () => {
    expect(formatEur(-288_000)).toBe("-2.880,00 €");
  });
});
