/**
 * @file
 * Hochgeladene Logo-SVGs werden serverseitig in die PDF-Erzeugung (react-pdf)
 * eingespeist UND via /settings/sender/logo wieder ausgeliefert. Beides bringt
 * eigene Anforderungen:
 *
 *  - Sicherheit: ein SVG kann <script>, on*-Handler und externe Referenzen
 *    enthalten. Vor dem Speichern wird es daher mit DOMPurify gehärtet.
 *  - Schrift: react-pdf kann SVG-<text> nur mit registrierten Fonts rendern;
 *    fremde Schriften lassen die PDF-Erzeugung hart abstürzen. Wir können Text
 *    ohne die Originalschrift nicht optisch verlustfrei übernehmen, deshalb
 *    wird ein SVG mit Live-Text abgelehnt (der Nutzer soll Schrift vorher in
 *    Pfade umwandeln).
 *  - Farben: react-pdf versteht Hex/rgb/hsl/benannte Farben, aber keine
 *    modernen Farbfunktionen (oklch, oklab, lab, lch, hwb, color()). Diese
 *    werden nach RGB konvertiert; ein bereits vorhandener RGB-Fallback in
 *    einer style-Deklaration wird bevorzugt.
 */

import { formatHex, formatRgb, parse as parseColor } from "culori";
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Erlaubte URI-Referenzen: nur Fragmente (#id) und eingebettete Rasterdaten.
 */
const SAFE_URI = /^(?:#|data:image\/(?:png|jpe?g|gif|webp);base64,)/iu;
const URI_ATTRS = ["href", "xlink:href", "src"];

/**
 * Definitions-Elemente, die react-pdf nur als direkte Kinder eines Wurzel-
 * <defs> auflöst (siehe getDefs in @react-pdf/layout). Exakte Schreibweise,
 * da im XML-Modus Selektoren case-sensitiv sind.
 */
const DEF_SELECTOR =
  "linearGradient, radialGradient, pattern, clipPath, marker, symbol, mask, filter";

/**
 * Elemente, die Text rendern oder Schriften definieren.
 */
const TEXT_TAGS = new Set([
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
 * Farbtragende Präsentations-Attribute bzw. CSS-Eigenschaften.
 */
const COLOR_PROPS = [
  "fill",
  "stroke",
  "stop-color",
  "color",
  "flood-color",
  "lighting-color",
  "solid-color",
];

/**
 * Moderne Farbfunktionen, die react-pdf nicht parsen kann.
 */
const MODERN_COLOR = /\b(?:oklch|oklab|lch|lab|hwb|color-mix|color)\s*\(/iu;

export type SvgSanitizeReason = "text" | "invalid";

export class SvgSanitizeError extends Error {
  constructor(readonly reason: SvgSanitizeReason) {
    super(`SVG sanitize failed: ${reason}`);
  }
}

/**
 * Parst das SVG im strikten XML-Modus und wirft `SvgSanitizeError("invalid")`
 * bei Parserfehlern oder fremdem Wurzelelement.
 */
const parseXml = (svg: string): Document => {
  const doc = new JSDOM(svg, { contentType: "image/svg+xml" }).window.document;

  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new SvgSanitizeError("invalid");
  }

  if (doc.documentElement?.localName.toLowerCase() !== "svg") {
    throw new SvgSanitizeError("invalid");
  }

  return doc;
};

/**
 * Erkennt Live-Text und Schriftdefinitionen (Text-Tags, `font-family`,
 * `@font-face`). Solche SVGs werden abgelehnt, weil react-pdf sie ohne
 * registrierte Fonts nicht rendern kann und dabei abstürzt.
 */
const containsText = (doc: Document): boolean => {
  for (const el of Array.from(doc.querySelectorAll("*"))) {
    if (TEXT_TAGS.has(el.localName.toLowerCase())) {
      return true;
    }

    if (el.hasAttribute("font-family") || el.hasAttribute("font")) {
      return true;
    }

    const style = el.getAttribute("style");
    if (style && /font-family|@font-face/iu.test(style)) {
      return true;
    }
  }

  for (const styleEl of Array.from(doc.querySelectorAll("style"))) {
    if (/@font-face|font-family/iu.test(styleEl.textContent ?? "")) {
      return true;
    }
  }

  return false;
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
  const colorProps = new Set(COLOR_PROPS);
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
    if (!prop || !value) {
      continue;
    }

    if (colorProps.has(prop)) {
      const renderable = renderableColor(value);
      if (renderable !== null) {
        resolvedColors.set(prop, renderable);
      }
    } else {
      passthrough.push(`${prop}: ${value}`);
    }
  }

  for (const [prop, value] of resolvedColors) {
    passthrough.push(`${prop}: ${value}`);
  }

  return passthrough.join("; ");
};

/**
 * Normalisiert alle Farb-Attribute und inline-Styles im Dokument auf von
 * react-pdf verstehbare Werte; nicht konvertierbare Farben werden entfernt.
 */
const normalizeColors = (doc: Document): void => {
  for (const el of Array.from(doc.querySelectorAll("*"))) {
    for (const prop of COLOR_PROPS) {
      if (!el.hasAttribute(prop)) {
        continue;
      }

      const renderable = renderableColor(el.getAttribute(prop) ?? "");

      if (renderable === null) {
        el.removeAttribute(prop);
      } else if (renderable !== el.getAttribute(prop)) {
        el.setAttribute(prop, renderable);
      }
    }

    const style = el.getAttribute("style");
    if (style) {
      el.setAttribute("style", normalizeStyle(style));
    }
  }
};

/**
 * Verschiebt Definitions-Elemente (Gradients, Pattern, clipPath ...) in ein
 * einzelnes Wurzel-<defs>. react-pdf löst `url(#id)`-Referenzen sonst nicht auf
 * und zeichnet die referenzierenden Formen ungefüllt (= unsichtbar).
 */
const consolidateDefs = (doc: Document): void => {
  const svg = doc.documentElement;

  const defElements = Array.from(svg.querySelectorAll(DEF_SELECTOR));
  if (defElements.length === 0) {
    return;
  }

  const rootChildren = Array.from(svg.children);
  let canonicalDefs =
    rootChildren.find((child) => child.localName.toLowerCase() === "defs") ??
    null;
  if (!canonicalDefs) {
    canonicalDefs = doc.createElementNS(SVG_NS, "defs");
    svg.insertBefore(canonicalDefs, svg.firstChild);
  }

  // Mehrere Wurzel-<defs> zusammenführen. React-pdf liest nur das erste.
  for (const child of rootChildren) {
    if (child !== canonicalDefs && child.localName.toLowerCase() === "defs") {
      while (child.firstChild) {
        canonicalDefs.appendChild(child.firstChild);
      }
      child.remove();
    }
  }

  // Lose (nicht in einem <defs> steckende) Definitionen einsammeln.
  for (const el of defElements) {
    if (!el.closest("defs")) {
      canonicalDefs.appendChild(el);
    }
  }
};

/**
 * Härtet und normalisiert ein hochgeladenes Logo-SVG. Wirft
 * `SvgSanitizeError("text")` bei Live-Text/Schrift und
 * `SvgSanitizeError("invalid")` bei nicht parsbarem SVG.
 */
export const sanitizeSvgLogo = (rawSvg: string): string => {
  if (containsText(parseXml(rawSvg))) {
    throw new SvgSanitizeError("text");
  }

  const { window } = new JSDOM("");
  const purify = createDOMPurify(
    window as unknown as Parameters<typeof createDOMPurify>[0],
  );

  // Externe Referenzen gezielt nur auf echten URI-Attributen entfernen, nicht
  // global via ALLOWED_URI_REGEXP, da DOMPurify das auch auf fill/stroke
  // (url(#...)-Paint-Server) anwendet und sonst alle nicht-Hex-Farben verwirft.
  purify.addHook("afterSanitizeAttributes", (node) => {
    for (const attr of URI_ATTRS) {
      const value = node.getAttribute?.(attr);
      if (value && !SAFE_URI.test(value)) {
        node.removeAttribute(attr);
      }
    }
  });

  // biome-ignore-start lint/style/useNamingConvention: DOMPurify-Config-Keys sind extern vorgegeben (SCREAMING_SNAKE).
  const cleaned = purify.sanitize(rawSvg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    // Defense in depth: Text-Tags sind oben bereits abgelehnt; <a>/foreignObject
    // sind in einem Logo unnötig und vergrößern die Angriffsfläche.
    FORBID_TAGS: [...TEXT_TAGS, "a", "foreignObject"],
    FORBID_ATTR: ["font-family", "font"],
  });
  // biome-ignore-end lint/style/useNamingConvention: siehe oben.

  const doc = parseXml(cleaned);

  normalizeColors(doc);
  consolidateDefs(doc);

  if (!doc.documentElement.getAttribute("xmlns")) {
    doc.documentElement.setAttribute("xmlns", SVG_NS);
  }

  return new window.XMLSerializer().serializeToString(doc.documentElement);
};
