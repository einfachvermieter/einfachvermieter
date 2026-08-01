import { Text, View } from "@react-pdf/renderer";
import {
  Children,
  createElement,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { describe, expect, it } from "vitest";
import { styles } from "../styles.js";
import { Table } from "./Table.js";

const ROW_LABEL = "Zeile";

const row = (index: number) => (
  <View key={index} style={styles.row}>
    <Text>{index}</Text>
  </View>
);

const rows = (count: number) =>
  Array.from({ length: count }, (_, index) => row(index));

/**
 * Ruft die Komponente direkt auf und liefert den erzeugten Elementbaum,
 * ohne PDF zu rendern.
 */
const render = (props: Parameters<typeof Table>[0]): ReactElement =>
  Table(props) as ReactElement;

const childrenOf = (element: ReactElement): ReactElement[] =>
  Children.toArray((element.props as { children?: ReactNode }).children).filter(
    isValidElement,
  );

/**
 * Zeilen-Elemente ohne `Children.toArray`, damit von der Komponente
 * vergebenen Keys erhalten bleiben
 */
const childrenOfRaw = (element: ReactElement): ReactElement[] => {
  const { children } = element.props as { children: ReactNode[] };

  return (children.at(-1) as ReactNode[]).filter(isValidElement);
};

describe("Table", () => {
  it("hält kurze Tabellen zusammen und wiederholt keine Kopfzeile", () => {
    const table = render({ head: <View />, children: rows(10) });

    expect((table.props as { wrap?: boolean }).wrap).toBe(false);
    expect((childrenOf(table)[0]?.props as { fixed?: boolean }).fixed).toBe(
      false,
    );
  });

  it("lässt lange Tabellen umbrechen und wiederholt die Kopfzeile", () => {
    const table = render({ head: <View />, children: rows(11) });

    expect((table.props as { wrap?: boolean }).wrap).toBe(true);
    expect((childrenOf(table)[0]?.props as { fixed?: boolean }).fixed).toBe(
      true,
    );
  });

  it("schützt jede Zeile gegen Umbruch", () => {
    const table = render({ children: rows(11) });

    for (const child of childrenOf(table)) {
      expect((child.props as { wrap?: boolean }).wrap).toBe(false);
    }
  });

  it("zählt Zeilen aus Fragmenten einzeln", () => {
    const table = render({ children: <>{rows(11)}</> });

    expect((table.props as { wrap?: boolean }).wrap).toBe(true);
    expect(childrenOf(table)).toHaveLength(11);
  });

  it("vergibt über Fragment-Grenzen hinweg eindeutige Zeilen-Keys", () => {
    // Ohne eigene Keys nummeriert `Children.toArray` je Fragment-Ebene neu -
    // die Zeilen aus der Gruppe kollidierten mit denen davor.
    const plainRow = (
      <View style={styles.row}>
        <Text>{ROW_LABEL}</Text>
      </View>
    );
    const group = createElement(Fragment, null, plainRow, plainRow);
    const table = render({ children: [plainRow, group] });

    const keys = childrenOfRaw(table).map((child) => child.key);

    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("bindet die Überschrift an eine kurze Tabelle", () => {
    const block = render({ heading: "Titel", children: rows(3) });

    expect((block.props as { wrap?: boolean }).wrap).toBe(false);
    expect(childrenOf(block)).toHaveLength(2);
  });

  it("hält bei langer Tabelle Platz unter der Überschrift frei", () => {
    const block = render({ heading: "Titel", children: rows(11) });
    const [heading] = childrenOf(block);

    expect(
      (heading?.props as { minPresenceAhead?: number }).minPresenceAhead,
    ).toBeGreaterThan(0);
  });
});
