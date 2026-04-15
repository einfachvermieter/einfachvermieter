import { View } from "@react-pdf/renderer";
import { styles } from "../styles.js";

/**
 * DIN-5008-Markierungen am linken Blattrand: Falzmarken bei 105 mm und
 * 210 mm vom oberen Rand sowie eine Lochmarke in Blattmitte (148,5 mm).
 *
 * Muss in jeder react-pdf Page eingehängt werden.
 */
export const LetterMarks = () => (
  <>
    <View style={styles.foldMarkTop} fixed={true} />
    <View style={styles.punchMark} fixed={true} />
    <View style={styles.foldMarkBottom} fixed={true} />
  </>
);
