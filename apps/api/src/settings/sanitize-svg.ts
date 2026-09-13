/**
 * @file
 * Hochgeladene Logo-SVGs werden serverseitig in die PDF-Erzeugung (react-pdf)
 * eingespeist UND via /settings/sender/logo wieder ausgeliefert.
 *
 * Die Grafik wird neu aufgebaut: der XML-Parser liefert einen Baum,
 * übernommen wird nur, was auf der Liste steht. Die Liste ist genau das,
 * was der SVG-Renderer von react-pdf zeichnen kann.
 *
 * Farben: react-pdf versteht Hex/rgb/hsl/benannte Farben, aber keine modernen
 * Farbfunktionen (oklch, oklab, lab, lch, hwb, color()). Diese werden nach RGB
 * konvertiert; ein bereits vorhandener RGB-Fallback in einer style-Deklaration
 * wird bevorzugt.
 */

import { formatHex, formatRgb, parse as parseColor } from "culori";
import { type SaxesAttributeNS, SaxesParser, type SaxesTagNS } from "saxes";

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";
const XMLNS_NS = "http://www.w3.org/2000/xmlns/";

/**
 * Erlaubte URI-Referenzen: nur Fragmente (#id) und eingebettete Rasterdaten.
 */
const SAFE_URI = /^(?:#|data:image\/(?:png|jpe?g|gif|webp);base64,)/iu;

/**
 * Elemente, die react-pdf zeichnen kann. Text-Elemente fehlen bewusst, die
 * werden gesondert abgelehnt.
 */
const RENDERABLE_ELEMENTS = new Set([
  "svg",
  "g",
  "defs",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "clipPath",
  "linearGradient",
  "radialGradient",
  "stop",
  "marker",
  "image",
]);

/**
 * Reine Beschreibung ohne Darstellung. Wird samt Unterbaum verworfen, damit
 * übliche Exporte aus Zeichenprogrammen nicht an ihren Metadaten scheitern.
 */
const IGNORED_ELEMENTS = new Set(["title", "desc", "metadata"]);

/**
 * Elemente, die Text rendern oder Schriften definieren (klein geschrieben,
 * der Vergleich läuft über die Kleinschreibung des lokalen Namens).
 */
const TEXT_ELEMENTS = new Set([
  "text",
  "tspan",
  "textpath",
  "tref",
  "altglyph",
  "altglyphdef",
  "altglyphitem",
  "glyph",
  "glyphref",
  "font",
  "font-face",
  "missing-glyph",
]);

/**
 * Definitionen, die react-pdf nur als direkte Kinder eines Wurzel-defs
 * auflöst. Exakte Schreibweise, XML-Namen sind groß-/kleinschreibungsecht.
 */
const DEFINITION_ELEMENTS = new Set([
  "linearGradient",
  "radialGradient",
  "clipPath",
  "marker",
]);

/**
 * Attribute ohne Namensraum, die übernommen werden. Unbekannte Attribute
 * werden entfernt statt abgelehnt: Zeichenprogramme hängen an jedes Element
 * eigene Vermerke, die nichts darstellen und nichts auslösen.
 */
const ALLOWED_ATTRIBUTES = new Set([
  "id",
  "class",
  "style",
  "transform",
  "viewBox",
  "version",
  "preserveAspectRatio",
  "width",
  "height",
  "x",
  "y",
  "rx",
  "ry",
  "cx",
  "cy",
  "r",
  "d",
  "points",
  "x1",
  "y1",
  "x2",
  "y2",
  "fx",
  "fy",
  "fr",
  "pathLength",
  "offset",
  "gradientUnits",
  "gradientTransform",
  "spreadMethod",
  "clipPathUnits",
  "clip-path",
  "clip-rule",
  "markerUnits",
  "markerWidth",
  "markerHeight",
  "refX",
  "refY",
  "orient",
  "overflow",
  "opacity",
  "color",
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-opacity",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stop-color",
  "stop-opacity",
  "display",
  "visibility",
  "vector-effect",
  "paint-order",
  "shape-rendering",
  "mix-blend-mode",
  "marker-start",
  "marker-mid",
  "marker-end",
]);

/**
 * Farbtragende Präsentations-Attribute bzw. CSS-Eigenschaften.
 */
const COLOR_PROPS = new Set(["fill", "stroke", "stop-color", "color"]);

/**
 * Moderne Farbfunktionen, die react-pdf nicht parsen kann.
 */
const MODERN_COLOR = /\b(?:oklch|oklab|lch|lab|hwb|color-mix|color)\s*\(/iu;

/**
 * `url(...)`, das nicht auf ein Fragment im selben Dokument zeigt. Solche
 * Verweise laden beim Anzeigen fremde Dateien nach.
 */
const FOREIGN_URL = /url\(\s*["']?(?!#)/iu;

export type SvgSanitizeReason = "text" | "forbidden" | "invalid";

export class SvgSanitizeError extends Error {
  constructor(
    readonly reason: SvgSanitizeReason,
    options?: ErrorOptions,
  ) {
    super(`SVG sanitize failed: ${reason}`, options);
  }
}

type SvgElement = {
  name: string;
  attributes: Map<string, string>;
  children: SvgElement[];
};

/**
 * Liefert einen für react-pdf renderbaren Farbwert oder `null`, wenn der Wert
 * eine nicht konvertierbare moderne Farbfunktion ist. Unterstützte Formate
 * (Hex/rgb/hsl/benannt/Schlüsselwörter) werden unverändert durchgereicht.
 */
const renderableColor = (value: string): string | null => {
  if (!MODERN_COLOR.test(value)) {
    return value;
  }

  const parsed = parseColor(value.trim());
  if (!parsed) {
    return null;
  }

  return parsed.alpha !== undefined && parsed.alpha < 1
    ? formatRgb(parsed)
    : formatHex(parsed);
};

/**
 * Wendet die Farbnormalisierung auf eine inline `style`-Deklaration an.
 */
const normalizeStyle = (style: string): string => {
  const passthrough: string[] = [];

  // Pro Farb-Eigenschaft gewinnt die letzte renderbare Deklaration (CSS:
  // last-valid-wins). So bleibt ein vorhandener RGB-Fallback erhalten, wenn
  // eine nachfolgende moderne Farbe nicht konvertierbar ist.
  const resolvedColors = new Map<string, string>();
  for (const declaration of style.split(";")) {
    const separator = declaration.indexOf(":");
    if (separator < 0) {
      continue;
    }

    const prop = declaration.slice(0, separator).trim().toLowerCase();
    const value = declaration.slice(separator + 1).trim();
    if (!prop || !value || FOREIGN_URL.test(value)) {
      continue;
    }

    if (COLOR_PROPS.has(prop)) {
      const renderable = renderableColor(value);
      if (renderable !== null) {
        resolvedColors.set(prop, renderable);
      }
    } else if (ALLOWED_ATTRIBUTES.has(prop)) {
      passthrough.push(`${prop}: ${value}`);
    }
  }

  for (const [prop, value] of resolvedColors) {
    passthrough.push(`${prop}: ${value}`);
  }

  return passthrough.join("; ");
};

/**
 * Prüft ein einzelnes Attribut und liefert Name und Wert für die Ausgabe
 * oder `null`, wenn es entfällt. `xlink:href` wird auf `href` normalisiert,
 * weil react-pdf nur den Namen ohne Präfix liest.
 */
const resolveAttribute = (
  attribute: SaxesAttributeNS,
): [string, string] | null => {
  const { local, uri, value } = attribute;

  if (uri === XMLNS_NS || local === "xmlns") {
    return null;
  }

  if (local.toLowerCase().startsWith("on")) {
    throw new SvgSanitizeError("forbidden");
  }

  if (local === "href" && (uri === "" || uri === XLINK_NS)) {
    if (!SAFE_URI.test(value.trim())) {
      throw new SvgSanitizeError("forbidden");
    }

    return ["href", value.trim()];
  }

  if (uri !== "" || !ALLOWED_ATTRIBUTES.has(local)) {
    return null;
  }

  if (local === "style") {
    const style = normalizeStyle(value);

    return style ? ["style", style] : null;
  }

  if (FOREIGN_URL.test(value)) {
    return null;
  }

  if (COLOR_PROPS.has(local)) {
    const color = renderableColor(value);

    return color === null ? null : [local, color];
  }

  return [local, value];
};

/**
 * Übernimmt die erlaubten Attribute eines Elements.
 */
const collectAttributes = (tag: SaxesTagNS): Map<string, string> => {
  const attributes = new Map<string, string>();

  for (const attribute of Object.values(tag.attributes)) {
    const resolved = resolveAttribute(attribute);

    if (resolved) {
      attributes.set(resolved[0], resolved[1]);
    }
  }

  return attributes;
};

/**
 * Baut aus dem SVG einen Baum aus erlaubten Elementen. Wirft bei allem, was
 * nicht auf die Liste passt; unbekannte Namensräume und Metadaten fallen
 * samt Unterbaum weg.
 */
const parseDocument = (rawSvg: string): SvgElement => {
  const parser = new SaxesParser({ xmlns: true });
  const stack: SvgElement[] = [];
  let root: SvgElement | null = null;
  let skipDepth = 0;
  let documentNamespace: string | null = null;

  parser.on("error", () => {
    throw new SvgSanitizeError("invalid");
  });

  // Ein DOCTYPE mit internem Teil darf eigene Entities erklären. Die stehen
  // im Rohtext nirgends als Markup, landen aber nach dem Auflösen im Baum.
  parser.on("doctype", (doctype) => {
    if (doctype.includes("[")) {
      throw new SvgSanitizeError("forbidden");
    }
  });

  parser.on("processinginstruction", () => {
    throw new SvgSanitizeError("forbidden");
  });

  parser.on("opentag", (tag) => {
    if (skipDepth > 0) {
      skipDepth += 1;
      return;
    }

    const { local } = tag;

    if (documentNamespace === null) {
      // Die Wurzel legt den Namensraum fest. Fehlt die xmlns-Angabe, gilt das
      // Dokument trotzdem als SVG; ausgeliefert wird es später mit xmlns.
      if (local !== "svg" || (tag.uri !== SVG_NS && tag.uri !== "")) {
        throw new SvgSanitizeError("invalid");
      }
      documentNamespace = tag.uri;
    } else if (tag.uri !== documentNamespace) {
      skipDepth = 1;
      return;
    }

    if (TEXT_ELEMENTS.has(local.toLowerCase())) {
      throw new SvgSanitizeError("text");
    }

    if (IGNORED_ELEMENTS.has(local)) {
      skipDepth = 1;
      return;
    }

    if (!RENDERABLE_ELEMENTS.has(local)) {
      throw new SvgSanitizeError("forbidden");
    }

    const element: SvgElement = {
      name: local,
      attributes: collectAttributes(tag),
      children: [],
    };

    stack.at(-1)?.children.push(element);
    stack.push(element);
    root ??= element;
  });

  parser.on("closetag", () => {
    if (skipDepth > 0) {
      skipDepth -= 1;
      return;
    }

    stack.pop();
  });

  try {
    parser.write(rawSvg).close();
  } catch (error) {
    if (error instanceof SvgSanitizeError) {
      throw error;
    }

    throw new SvgSanitizeError("invalid", { cause: error });
  }

  if (root === null) {
    throw new SvgSanitizeError("invalid");
  }

  return root;
};

/**
 * Löst alle Definitionen aus dem Baum und sammelt sie ein. react-pdf löst
 * `url(#id)` sonst nicht auf und zeichnet die verweisende Form ungefüllt
 * (= unsichtbar).
 */
const extractDefinitions = (
  element: SvgElement,
  collected: SvgElement[],
): void => {
  const kept: SvgElement[] = [];

  for (const child of element.children) {
    if (child.name === "defs") {
      collected.push(...child.children);
      continue;
    }

    if (DEFINITION_ELEMENTS.has(child.name)) {
      collected.push(child);
      continue;
    }

    extractDefinitions(child, collected);
    kept.push(child);
  }

  element.children = kept;
};

/**
 * Hängt alle Definitionen in ein einzelnes Wurzel-defs.
 */
const consolidateDefs = (root: SvgElement): void => {
  const definitions: SvgElement[] = [];
  extractDefinitions(root, definitions);

  if (definitions.length === 0) {
    return;
  }

  root.children.unshift({
    name: "defs",
    attributes: new Map(),
    children: definitions,
  });
};

const escapeAttribute = (value: string): string =>
  value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/[\n\r\t]/gu, " ");

const serialize = (element: SvgElement): string => {
  const attributes = [...element.attributes]
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join("");

  if (element.children.length === 0) {
    return `<${element.name}${attributes}/>`;
  }

  return `<${element.name}${attributes}>${element.children
    .map(serialize)
    .join("")}</${element.name}>`;
};

/**
 * Baut ein hochgeladenes Logo-SVG aus erlaubten Elementen neu auf. Wirft
 * `SvgSanitizeError("text")` bei Live-Text/Schrift, `("forbidden")` bei
 * nicht erlaubten Elementen, Attributen oder Verweisen und `("invalid")` bei
 * nicht parsbarem SVG.
 */
export const sanitizeSvgLogo = (rawSvg: string): string => {
  const root = parseDocument(rawSvg);

  consolidateDefs(root);
  root.attributes.set("xmlns", SVG_NS);

  return serialize(root);
};
