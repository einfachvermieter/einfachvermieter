import { Text } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { styles } from "./styles.js";

/**
 * Hochgestellte Unicode-Zeichen -> normale Ziffer. Statt der Unicode-Hochzeichen
 * rendern wir normale Ziffern, die via `styles.superscript` kleiner und
 * hochgestellt dargestellt werden, typografisch kontrolliert (einheitliche
 * Größe/Höhe) und unabhängig davon, ob die Schrift eigene Superscript-Glyphen
 * besitzt.
 */
const DIGIT_TO_SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/**
 * Wandelt eine Zahl in hochgestellte Unicode-Ziffern (z. B. 12 -> "¹²"). Wird
 * für Fußnoten-Marker genutzt
 */
export const toSuperscript = (value: number): string =>
  String(value)
    .split("")
    .map((digit) => DIGIT_TO_SUPERSCRIPT[Number(digit)] ?? digit)
    .join("");

const SUPERSCRIPT_TO_DIGIT: Record<string, string> = {
  "⁰": "0", // ⁰
  "¹": "1", // ¹
  "²": "2", // ²
  "³": "3", // ³
  "⁴": "4", // ⁴
  "⁵": "5", // ⁵
  "⁶": "6", // ⁶
  "⁷": "7", // ⁷
  "⁸": "8", // ⁸
  "⁹": "9", // ⁹
};

/**
 * Ersetzt hochgestellte Unicode-Zeichen in einem Text durch echt hochgestellte
 * normale Ziffern (als verschachteltes `<Text>`); übriger Text bleibt
 * unverändert.
 */
export const renderSuperscripts = (
  text: string | null | undefined,
): ReactNode[] => {
  if (!text) {
    return [];
  }

  const parts: ReactNode[] = [];
  let plain = "";
  let superseq = "";

  const flushPlain = () => {
    if (plain) {
      parts.push(plain);
      plain = "";
    }
  };

  const flushSuper = () => {
    if (superseq) {
      parts.push(
        <Text key={parts.length} style={styles.superscript}>
          {superseq}
        </Text>,
      );
      superseq = "";
    }
  };

  for (const char of text) {
    const digit = SUPERSCRIPT_TO_DIGIT[char];

    if (digit !== undefined) {
      flushPlain();
      superseq += digit;
    } else {
      flushSuper();
      plain += char;
    }
  }

  flushPlain();
  flushSuper();

  return parts;
};
