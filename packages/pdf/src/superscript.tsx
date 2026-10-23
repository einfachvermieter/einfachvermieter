import { Text } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { styles } from "./styles.js";

/**
 * Hochgestellte Unicode-Ziffern 0 bis 9, Index = Ziffer. Im PDF werden sie
 * nicht als Glyphe ausgegeben, sondern als normale Ziffer, die
 * `styles.superscript` kleiner und hochgestellt setzt: einheitliche
 * Größe/Höhe, unabhängig davon, ob die Schrift eigene Superscript-Glyphen
 * besitzt.
 */
const DIGIT_TO_SUPERSCRIPT =
  "\u2070\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079";

/**
 * Wandelt eine Zahl in hochgestellte Unicode-Ziffern (jede Ziffer
 * einzeln, 12 ergibt zwei hochgestellte Ziffern). Wird für Fußnoten-Marker genutzt
 */
export const toSuperscript = (value: number): string =>
  String(value)
    .split("")
    .map((digit) => DIGIT_TO_SUPERSCRIPT[Number(digit)] ?? digit)
    .join("");

const SUPERSCRIPT_TO_DIGIT: Record<string, string> = Object.fromEntries(
  [...DIGIT_TO_SUPERSCRIPT].map((superscript, digit) => [
    superscript,
    String(digit),
  ]),
);

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
