import { Text, View } from "@react-pdf/renderer";
import {
  Children,
  cloneElement,
  Fragment,
  isValidElement,
  type ReactNode,
} from "react";
import {
  FOOTNOTE_PRESENCE_AHEAD,
  HEADING_PRESENCE_AHEAD,
  styles,
} from "../styles.js";

/**
 * Bis einschließlich so vieler Datenzeilen bleibt eine Tabelle
 * geschlossen auf einer Seite. Längere Tabellen dürfen umbrechen; die
 * Kopfzeile wird dann auf jeder Folgeseite wiederholt.
 */
const KEEP_TOGETHER_ROWS = 10;

type Props = {
  /**
   * Überschrift über der Tabelle. Steht nie allein am Seitenfuß.
   * ReactNode, damit Fußnoten-Marker hochgestellt werden können.
   */
  heading?: ReactNode;
  /**
   * Zellen der Kopfzeile, ohne umgebende Zeilen-View. Bei umbrechenden
   * Tabellen wiederholt sich die Kopfzeile auf jeder Folgeseite.
   */
  head?: ReactNode;
  /**
   * Datenzeilen, je ein `<View style={styles.row}>`. Zeilen, die aus
   * einer eigenen Komponente statt direkt aus einer View kommen, zählt
   * die Komponente als eine Zeile und schützt sie nicht gegen Umbruch;
   * solche Komponenten setzen `wrap={false}` selbst.
   */
  children: ReactNode;
  /**
   * Fußnoten und Hinweise unter der Tabelle. Sie stehen nie allein auf
   * der Folgeseite, damit die Marker im Tabellenkopf nicht ins Leere
   * zeigen.
   */
  footer?: ReactNode;
  /**
   * Variante ohne Außenrahmen und Innengitter.
   */
  plain?: boolean;
};

/**
 * Löst Fragmente auf, damit gruppierte Zeilen einzeln gezählt und
 * einzeln gegen Umbruch geschützt werden können.
 */
const flattenRows = (nodes: ReactNode): ReactNode[] =>
  Children.toArray(nodes).flatMap((node) =>
    isValidElement<{ children?: ReactNode }>(node) && node.type === Fragment
      ? // `Children.toArray` nummeriert je Ebene neu; ohne den Key des
        // Fragments davor kollidieren die aufgelösten Zeilen mit denen der
        // äußeren Ebene.
        flattenRows(node.props.children).map((row) =>
          isValidElement(row)
            ? cloneElement(row, { key: `${node.key}${row.key}` })
            : row,
        )
      : [node],
  );

/**
 * Tabellen-Container mit den Umbruchregeln für mehrseitige Dokumente:
 * eine Zeile läuft nie über zwei Seiten, kurze Tabellen bleiben ganz
 * zusammen, lange Tabellen brechen um und wiederholen ihre Kopfzeile.
 */
export const Table = ({ heading, head, children, footer, plain }: Props) => {
  const rows = flattenRows(children);
  const keepTogether = rows.length <= KEEP_TOGETHER_ROWS;
  const hasFooter = flattenRows(footer).length > 0;
  // react-pdf prüft den Platz nach einer Zeile nur gegen Geschwister und
  // schaut nur in Container, die selbst über das Seitenende ragen. Damit
  // die letzte Zeile mit den Fußnoten wandert, stehen Kopf, Zeilen und
  // Fußnoten deshalb in einem gemeinsamen Container ohne Rahmen; den
  // Außenrahmen tragen Kopf und Zeilen selbst.
  const footerInFlow = hasFooter && !keepTogether;
  const lastRowIndex = rows.length - 1;
  const edges = footerInFlow && !plain;

  const rowEdges = (index: number) => [
    styles.tableEdgeSides,
    ...(index === 0 && head === undefined ? [styles.tableEdgeTop] : []),
    ...(index === lastRowIndex ? [styles.tableEdgeBottom] : []),
  ];

  const table = (
    <View
      style={
        footerInFlow
          ? styles.tableOpen
          : plain
            ? styles.tablePlain
            : styles.table
      }
      wrap={!keepTogether}
    >
      {head === undefined ? null : (
        <View
          style={
            edges
              ? [styles.rowHeader, styles.tableEdgeSides, styles.tableEdgeTop]
              : styles.rowHeader
          }
          fixed={!keepTogether}
        >
          {head}
        </View>
      )}

      {rows.map((row, index) =>
        isValidElement<{
          wrap?: boolean;
          minPresenceAhead?: number;
          style?: unknown;
        }>(row)
          ? cloneElement(row, {
              wrap: false,
              ...(edges
                ? {
                    style: [row.props.style ?? [], rowEdges(index)].flat(),
                  }
                : {}),
              // Passt der Anfang der Fußnoten nicht mehr unter die letzte
              // Zeile, wandert die Zeile mit auf die Folgeseite.
              ...(footerInFlow && index === lastRowIndex
                ? { minPresenceAhead: FOOTNOTE_PRESENCE_AHEAD }
                : {}),
            })
          : row,
      )}

      {footerInFlow ? <View style={styles.tableFooter}>{footer}</View> : null}
    </View>
  );

  if (!heading && !hasFooter) {
    return table;
  }

  const headingText = !heading ? null : (
    <Text
      style={styles.sectionHeading}
      minPresenceAhead={keepTogether ? undefined : HEADING_PRESENCE_AHEAD}
    >
      {heading}
    </Text>
  );

  // Kurze Tabelle: Überschrift, Tabelle und Fußnoten sind ein
  // untrennbarer Block. Lange Tabelle: die Überschrift braucht nur genug
  // Folgezeilen auf derselben Seite, umbrechen darf die Tabelle danach.
  if (keepTogether) {
    return (
      <View wrap={false}>
        {headingText}
        {table}
        {footer}
      </View>
    );
  }

  return (
    <>
      {headingText}
      {table}
    </>
  );
};
