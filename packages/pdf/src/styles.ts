import { StyleSheet } from "@react-pdf/renderer";

// ── Design-Tokens ─────────────────────────────────────────────────
const BLACK = "#000000";
const OPERATOR_GRAY = "#888888"; // Rechenzeichen in Tabellen
const HEADER_GRAY = "#DDDDDD"; // Hintergrund Tabellenkopf

const TEXT_SIZE = 10; // Brieftext
const SMALL_SIZE = 8.0; // Tabellen + Fußnoten
const ENVELOPE_SENDER_SIZE = 7.5; // Sender-Zeile im Adressfenster

const LINE_HEIGHT = 1.4;
const LINE_HEIGHT_TIGHT = 1.2; // nur Fußnoten

const SEMIBOLD = 600; // einzige Hervorhebung, kein Bold

/**
 * Linie in Tabellen
 */
const LINE = `0.5pt solid ${BLACK}`;
/**
 * Stärkere Variante über Summenzeilen, hebt die Zeile optisch ab.
 */
const LINE_STRONG = `1.5pt solid ${BLACK}`;

/**
 * Innenabstand der Tabellenzellen, nur auf der Alignment-Seite, damit
 * rechtsbündige Zahlen nicht durch unbenutztes Left-Padding gequetscht
 * werden. Vertikal beidseitig, damit Text nicht am Rahmen klebt.
 */
const CELL_PAD_X = 4;

/**
 * Freier Platz, der unter einer Überschrift noch auf die Seite passen
 * muss (etwa drei Tabellenzeilen). Reicht er nicht, wandert die
 * Überschrift zusammen mit dem Tabellenanfang auf die nächste Seite.
 */
export const HEADING_PRESENCE_AHEAD = 60;

/**
 * Vertikales Zell-Padding bewusst asymmetrisch: Geist Font wirkt bei
 * vertikal zentrierter Ausrichtung leider optisch nicht mittig.
 * -> Deshalb entsprechend unterschiedliche Paddings oben und unten.
 */
const CELL_PAD_TOP = 5.4;
const CELL_PAD_BOTTOM = 4.6;

/**
 * Gleiche Geist-Problematik für die rahmenlosen Zellen (erste Seite)
 */
const CELL_PAD_PLAIN_TOP = 3.5;
const CELL_PAD_PLAIN_BOTTOM = 2.5;

export const styles = StyleSheet.create({
  // ── Seiten-Layout (DIN 5008 Form B) ──────────────────────────────
  // Margins gelten auf jeder Seite gleich. Auf Seite 1 schiebt
  // `letterContent.paddingTop` den Brief unter das DIN-Adressfeld.
  // A4 = 595 x 842 pt; 1 mm ~= 2,8346 pt.
  page: {
    paddingTop: 56.69, // 20 mm
    paddingLeft: 70.87, // 25 mm
    paddingRight: 56.69, // 20 mm
    paddingBottom: 56.69, // 20 mm
    fontSize: TEXT_SIZE,
    fontFamily: "Geist",
    color: BLACK,
    // `lineHeight` darf hier NICHT gesetzt werden. react-pdf 4.5.x hat
    // einen Bug, bei dem ein page-weit geerbter lineHeight die dynamische
    // Footer-Renderung (<Text fixed render={...}>) verschluckt. Der Footer
    // wird dann nicht in den PDF-Stream geschrieben, obwohl der
    // Render-Callback aufgerufen wird.
  },

  // ── DIN-Markierungen am linken Blattrand ─────────────────────────
  foldMarkTop: {
    position: "absolute",
    top: 297.64, // 105 mm
    left: 0,
    width: 14.17, // 5 mm
    height: 0.5,
    backgroundColor: OPERATOR_GRAY,
  },
  foldMarkBottom: {
    position: "absolute",
    top: 595.28, // 210 mm
    left: 0,
    width: 14.17,
    height: 0.5,
    backgroundColor: OPERATOR_GRAY,
  },
  punchMark: {
    position: "absolute",
    top: 421.1, // 148,5 mm
    left: 0,
    width: 14.17,
    height: 0.7,
    backgroundColor: OPERATOR_GRAY,
  },

  // ── Absender oben rechts + Adressfeld im Sichtfenster ───────────
  senderHeader: {
    position: "absolute",
    top: 141.72, // 50 mm
    right: 28.34, // 10 mm
    width: 212, // 75 mm
    alignItems: "flex-start",
  },

  // Logo absolut im Briefkopf platziert. Volle Box-Größe + `objectFit:
  // contain` skaliert das Bild proportional auf die größte ins Rechteck
  // passende Darstellung (ohne Verzerrung, ohne Crop)
  senderLogo: {
    position: "absolute",
    top: 28.35, // 10 mm
    left: 70.86, // 25 mm
    width: 467.68, // 165 mm
    height: 70.86, // 25 mm
    objectFit: "contain",
  },

  // 7,5pt Mini-Zeile direkt über dem Empfängerblock im Sichtfenster.
  envelopeSender: {
    fontSize: ENVELOPE_SENDER_SIZE,
    marginBottom: 6,
  },

  // DIN 5008 Form B: oben 45 (+10 padding) mm, links 20 (+5 padding) mm, 85x40 mm.
  addressFieldB: {
    position: "absolute",
    top: 155.9, // 45+10 mm
    left: 70.86, // 20 mm
    width: 226.76, // 85-5 mm
    height: 113.39, // 40 mm
  },

  // Brieftext beginnt 86 mm vom oberen Rand (45 mm Adressfeld-Top
  // + 40 mm Höhe + 1 mm Luft). `page.paddingTop` deckt 20 mm ab.
  // Eng genug, damit Datumszeile + Betreffzeile noch über der oberen
  // Falzmarke bei 105 mm liegen.

  letterContent: {
    paddingTop: 187.09, // 66 mm
    // `fontSize` muss neben `lineHeight` auf derselben View stehen, sonst
    // interpretiert react-pdf 4.5.x den numerischen lineHeight-Multiplikator
    // gegen die natürliche Font-Linienhöhe (~1,8) statt gegen `fontSize`.
    fontSize: TEXT_SIZE,
    lineHeight: LINE_HEIGHT,
  },

  documentMeta: {
    alignItems: "flex-end",
    marginBottom: 18,
  },

  // ── Text-Primitive ───────────────────────────────────────────────
  bold: { fontWeight: SEMIBOLD },
  small: { fontSize: SMALL_SIZE },

  // Pflicht-Textblöcke, die niemand liest (Beratungsstellen,
  // Streitbeilegung): Tabellen-Schriftgröße. Auf die umgebende View
  // gesetzt, die Kind-Texte erben sie; Überschriften setzen ihre eigene
  // Größe und bleiben davon unberührt.
  fineprint: {
    fontSize: SMALL_SIZE,
    lineHeight: LINE_HEIGHT_TIGHT,
  },

  // Fußnote, engerer Zeilenabstand als der restliche Text.
  footnote: {
    fontSize: SMALL_SIZE,
    lineHeight: LINE_HEIGHT_TIGHT,
    marginTop: 4,
  },

  // Grau für Rechenzeichen (`×`, `:`, `=`) in Tabellen.
  operator: { color: OPERATOR_GRAY },

  // Hochgestellte Ziffern (Fußnoten-Marker, `m²`/`m³`) werden als normale
  // Ziffern kleiner und via `verticalAlign` hochgestellt gerendert.
  superscript: { fontSize: SMALL_SIZE * 0.7, verticalAlign: "super" },

  // ── Block-Überschriften ──────────────────────────────────────────
  subject: {
    fontWeight: SEMIBOLD,
    marginBottom: 20,
  },
  paragraph: { marginBottom: 10 },
  sectionHeading: {
    fontWeight: SEMIBOLD,
    marginTop: 20,
    marginBottom: 10,
  },
  appendixHeading: {
    fontWeight: SEMIBOLD,
    marginBottom: 15,
    fontSize: TEXT_SIZE,
    lineHeight: LINE_HEIGHT,
  },

  // Zwischen-Überschrift für Folge-Blöcke auf der fließenden Anhang-Seite.
  appendixSubheading: {
    fontWeight: SEMIBOLD,
    marginTop: 20,
    marginBottom: 8,
    fontSize: TEXT_SIZE,
    lineHeight: LINE_HEIGHT,
  },

  // ── Tabellen ─────────────────────────────────────────────────────
  // Außenrahmen sitzt auf der `table`-View. Innenraster wird erzeugt,
  // indem jede Row ab Index 1 `rowDivider` (borderTop) und jede Cell
  // ab Spalte 1 `cellDivider` (borderLeft) bekommt. So entstehen
  // weder Doppellinien noch fehlende Striche zum Außenrand.
  table: {
    width: "100%",
    marginBottom: 15,
    fontSize: SMALL_SIZE,
    lineHeight: LINE_HEIGHT_TIGHT,
    // Tabular-Variante mit eingefrorenem `tnum`-Feature für die ganze
    // Tabelle. Alle Spalten (auch Label-/Header-Zellen) nutzen Ziffern
    // gleicher Laufweite.
    fontFamily: "Geist Tnum",
    border: LINE,
  },

  // Tabellen-Variante ohne Außenrahmen und ohne Innengitter, für die
  // Übersicht auf Seite 1.
  tablePlain: {
    width: "100%",
    marginBottom: 15,
    fontFamily: "Geist Tnum",
  },

  row: { flexDirection: "row" },
  rowDivider: { borderTop: LINE },

  // Stärkerer Trenner über Summenzeilen (1pt statt 0.5pt).
  rowDividerStrong: { borderTop: LINE_STRONG },
  rowHeader: {
    flexDirection: "row",
    backgroundColor: HEADER_GRAY,
    fontWeight: SEMIBOLD,
  },
  cellDivider: { borderLeft: LINE },

  // Cells sind Views, damit mehrzeilige Inhalte funktionieren und
  // Single-Liner via `justifyContent: center` auf die Zellmitte sitzen.
  cellLeft: {
    textAlign: "left",
    paddingLeft: CELL_PAD_X,
    paddingTop: CELL_PAD_TOP,
    paddingBottom: CELL_PAD_BOTTOM,
    justifyContent: "center",
  },

  cellRight: {
    textAlign: "right",
    paddingRight: CELL_PAD_X,
    paddingTop: CELL_PAD_TOP,
    paddingBottom: CELL_PAD_BOTTOM,
    justifyContent: "center",
  },

  // Cell-Varianten ohne X-Padding, für rahmenlose Tabellen
  // wo der Text bündig an der Block-Außenkante sitzen soll.
  cellLeftPlain: {
    textAlign: "left",
    paddingTop: CELL_PAD_PLAIN_TOP,
    paddingBottom: CELL_PAD_PLAIN_BOTTOM,
    justifyContent: "center",
  },

  cellRightPlain: {
    textAlign: "right",
    paddingTop: CELL_PAD_PLAIN_TOP,
    paddingBottom: CELL_PAD_PLAIN_BOTTOM,
    justifyContent: "center",
  },

  // Header-Variante einer Zelle: grauer Hintergrund + Semibold. Wird für
  // Tabellen verwendet, deren Labels nicht in einer Header-Zeile oben,
  // sondern in einer Header-Spalte links stehen (z. B. die Eckdaten-
  // Tabelle auf Seite 1).
  cellLeftHeader: {
    textAlign: "left",
    paddingLeft: CELL_PAD_X,
    paddingRight: CELL_PAD_X,
    paddingTop: CELL_PAD_TOP,
    paddingBottom: CELL_PAD_BOTTOM,
    justifyContent: "center",
    backgroundColor: HEADER_GRAY,
    fontWeight: SEMIBOLD,
  },

  // ── Bruchnotation in Tabellenzellen (CostsTable: Bemessung / Tage) ──
  // Bruchstrich und Operator sind "Rechenzeichen" -> OPERATOR_GRAY.
  fractionStack: { flex: 1, alignItems: "flex-end" },
  fractionTop: { alignSelf: "flex-end" },
  fractionBottom: {
    alignSelf: "flex-end",
    borderTop: `0.5pt solid ${OPERATOR_GRAY}`,
  },

  fractionOperator: {
    paddingLeft: 4,
    color: OPERATOR_GRAY,
  },

  // ── Balkengrafik Vorperiodenvergleich ─────────────────────────────
  // Zwei horizontale Balken (dieser/vorheriger Zeitraum). Der helle
  // Laufbalken zeigt die volle Skala, darauf sitzt der dunklere Wertbalken
  energyBarRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  energyBarLabel: {
    width: 200,
    fontSize: SMALL_SIZE,
    lineHeight: LINE_HEIGHT_TIGHT,
  },
  energyBarTrack: {
    flex: 1,
    height: 9,
    backgroundColor: "#EEEEEE",
  },
  energyBar: {
    height: "100%",
    backgroundColor: "#BBBBBB",
  },
  // Breit genug für den längsten Wert („9.999.999 Verbrauchseinheiten"),
  // sonst bricht react-pdf mit Trennstrich um und der Wert liest sich
  // wie ein Minus.
  energyBarValue: {
    width: 145,
    textAlign: "right",
    fontSize: SMALL_SIZE,
    fontFamily: "Geist Tnum",
  },

  // ── Draft-Wasserzeichen ──────────────────────────────────────────
  // "ENTWURF" als diagonaler Schriftzug auf jeder Seite, solange die
  // Abrechnung im Draft-Status ist. Wird in jeder Page als LETZTES Element
  // gerendert, damit das Wasserzeichen optisch oben liegt
  draftWatermark: {
    position: "absolute",
    top: 340,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 110,
    color: "rgba(0, 0, 0, 0.1)",
    fontWeight: SEMIBOLD,
    letterSpacing: 10,
    transform: "rotate(-45deg)",
  },

  // ── Zweispaltiger Block auf Seite 1 ──────────────────────────────
  // Meta-Tabelle (links) und SummaryBlock (rechts) sitzen nebeneinander.
  // Spaltenverhältnis 1:1 mit kleinem Gutter dazwischen.
  twoColumnRow: {
    flexDirection: "row",
    marginTop: 10,
    marginBottom: 10,
  },
  twoColumnLeft: {
    flex: 1,
    paddingRight: 12,
  },
  twoColumnRight: {
    flex: 1,
    paddingLeft: 12,
  },

  // ── Footer ──────────────────────────────────────────────────────
  // Footer ist eine Row mit drei gleich breiten Zellen: links (Dokument-
  // typ), Mitte (Abrechnungs-ID) und rechts (Seitenzahl).
  footer: {
    position: "absolute",
    bottom: 28.35, // 10 mm
    left: 70.87,
    right: 56.69,
    fontSize: SMALL_SIZE,
    flexDirection: "row",
  },
  footerLeft: {
    flex: 1,
    textAlign: "left",
  },
  footerCenter: {
    flex: 1,
    textAlign: "center",
  },
  footerRight: {
    flex: 1,
    textAlign: "right",
  },
});
