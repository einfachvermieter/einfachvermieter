import { describe, expect, it } from "vitest";
import {
  amountRegex,
  centsToEurInput,
  formatEur,
  parseEurToCents,
  unsignedAmountRegex,
} from "./format.js";

describe("formatEur", () => {
  it("zeigt bei einer Null mit umgekehrtem Vorzeichen kein Minus", () => {
    expect(formatEur(-0)).toBe("0,00 €");
  });

  it("behält das Vorzeichen bei echten negativen Beträgen", () => {
    expect(formatEur(-288_000)).toBe("-2.880,00 €");
  });
});

describe("parseEurToCents", () => {
  it.each([
    ["1234,56", 123_456],
    ["1234.56", 123_456],
    ["1.234,56", 123_456],
    ["12.345,67", 1_234_567],
    ["1.234", 123_400],
    ["999,99", 99_999],
    ["250", 25_000],
    ["-1.234,56", -123_456],
    ["-5.50", -550],
    ["1 234,56", 123_456],
  ])("liest %s als %i Cent", (input, expected) => {
    expect(parseEurToCents(input)).toBe(expected);
  });

  it("liefert bei unlesbarer Eingabe null Cent", () => {
    expect(parseEurToCents("")).toBe(0);
    expect(parseEurToCents("abc")).toBe(0);
  });

  it("liest jeden Betrag zurück, den centsToEurInput erzeugt", () => {
    for (const cents of [0, 5, 99, 100, 123_456, 1_234_567, -288_000]) {
      expect(parseEurToCents(centsToEurInput(cents))).toBe(cents);
    }
  });
});

describe("amountRegex", () => {
  it.each([
    "1234,56",
    "1234.56",
    "1.234,56",
    "12.345,67",
    "250",
    "1.234",
  ])("nimmt %s an", (input) => {
    expect(unsignedAmountRegex.test(input)).toBe(true);
    expect(amountRegex.test(`-${input}`)).toBe(true);
  });

  it.each([
    "1.234.56",
    "1,234,56",
    "1234,567",
    "12.34,56",
    "abc",
    "",
    "1,",
  ])("weist %s ab", (input) => {
    expect(amountRegex.test(input)).toBe(false);
  });

  it("weist negative Beträge im vorzeichenlosen Muster ab", () => {
    expect(unsignedAmountRegex.test("-250")).toBe(false);
  });

  it("nimmt nur an, was der Parser auch richtig liest", () => {
    // Das Muster darf keine Schreibweise durchlassen, die anschließend
    // anders gelesen wird, als der Nutzer sie gemeint hat.
    expect(parseEurToCents("1.234,56")).toBe(123_456);
    expect(parseEurToCents("1234.56")).toBe(123_456);
  });
});
