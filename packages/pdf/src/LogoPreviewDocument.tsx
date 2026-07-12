import { Document, Image, Page, StyleSheet } from "@react-pdf/renderer";
import { styles } from "./styles.js";

export type LogoPreviewDocumentProps = {
  /**
   * Data-URI des (bereits sanitisierten) Logos
   */
  logoDataUri: string;
};

// Vorschau zeigt das Logo an exakt derselben Position/Größe wie im echten PDF.
const A4_WIDTH_PT = 595.28; // 210 mm
/**
 * DIN-A4-Höhe auf den Briefkopf gekürzt: 10 mm Rand + 25 mm Logo + 10 mm Rand = 45 mm
 */
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
