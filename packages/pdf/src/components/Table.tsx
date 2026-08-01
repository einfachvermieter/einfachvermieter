import { Text, View } from "@react-pdf/renderer";
import {
  Children,
  cloneElement,
  Fragment,
  isValidElement,
  type ReactNode,
} from "react";
import { HEADING_PRESENCE_AHEAD, styles } from "../styles.js";

/**
 * Bis einschließlich so vieler Datenzeilen bleibt eine Tabelle
 * geschlossen auf einer Seite. Längere Tabellen dürfen umbrechen; die
 * Kopfzeile wird dann auf jeder Folgeseite wiederholt.
 */
const KEEP_TOGETHER_ROWS = 10;

type Props = {
  /**
   * Überschrift über der Tabelle. Steht nie allein am Seitenfuß.
   */
  heading?: string;
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
export const Table = ({ heading, head, children, plain }: Props) => {
  const rows = flattenRows(children);
  const keepTogether = rows.length <= KEEP_TOGETHER_ROWS;

  const table = (
    <View style={plain ? styles.tablePlain : styles.table} wrap={!keepTogether}>
      {head === undefined ? null : (
        <View style={styles.rowHeader} fixed={!keepTogether}>
          {head}
        </View>
      )}

      {rows.map((row) =>
        isValidElement<{ wrap?: boolean }>(row)
          ? cloneElement(row, { wrap: false })
          : row,
      )}
    </View>
  );

  if (!heading) {
    return table;
  }

  // Kurze Tabelle: Überschrift und Tabelle sind ein untrennbarer Block.
  // Lange Tabelle: die Überschrift braucht nur genug Folgezeilen auf
  // derselben Seite, umbrechen darf die Tabelle danach.
  if (keepTogether) {
    return (
      <View wrap={false}>
        <Text style={styles.sectionHeading}>{heading}</Text>
        {table}
      </View>
    );
  }

  return (
    <>
      <Text
        style={styles.sectionHeading}
        minPresenceAhead={HEADING_PRESENCE_AHEAD}
      >
        {heading}
      </Text>
      {table}
    </>
  );
};
