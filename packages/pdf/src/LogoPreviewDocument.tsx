import { Document, Image, Page, StyleSheet } from "@react-pdf/renderer";
import { styles } from "./styles.js";

export type LogoPreviewDocumentProps = {
  /**
   * Data-URI des (bereits sanitisierten) Logos
   */
  logoDataUri: string;
};

// Vorschau zeigt das Logo an exakt derselben Position/Größe wie im echten PDF
// Die DINA4-Höhe wird auf den Briefkopf gekürzt.
const A4_WIDTH_PT = 595.28; // 210 mm
// 10 mm Rand oben + 25 mm Logo + 10 mm Rand unten = 45 mm.
const BAND_HEIGHT_PT = 127.56;

const previewStyles = StyleSheet.create({
  page: { backgroundColor: "#ffffff" },
});

export const LogoPreviewDocument = ({
  logoDataUri,
}: LogoPreviewDocumentProps) => (
  <Document>
    <Page
      size={{ width: A4_WIDTH_PT, height: BAND_HEIGHT_PT }}
      style={previewStyles.page}
    >
      <Image src={logoDataUri} style={styles.senderLogo} />
    </Page>
  </Document>
);
