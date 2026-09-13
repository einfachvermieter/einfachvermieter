import { describe, expect, it } from "vitest";
import { SvgSanitizeError, sanitizeSvgLogo } from "./sanitize-svg.js";

const wrap = (inner: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">${inner}</svg>`;

/**
 * Liefert den Ablehnungsgrund des Sanitizers. Läuft er durch oder scheitert er
 * an etwas anderem, beschreibt der Rückgabewert genau das.
 */
const rejectionReason = (svg: string): string => {
  try {
    sanitizeSvgLogo(svg);
  } catch (error) {
    return error instanceof SvgSanitizeError
      ? error.reason
      : `fremder Fehler: ${String(error)}`;
  }

  return "keine Ablehnung";
};

describe("sanitizeSvgLogo", () => {
  it("converts modern color functions to RGB in presentation attributes", () => {
    const out = sanitizeSvgLogo(wrap('<rect fill="oklch(0.7 0.15 250)" />'));

    expect(out).toMatch(/fill="#[0-9a-f]{6}"/iu);
    expect(out).not.toMatch(/oklch/iu);
  });

  it("leaves supported colors (hex/rgb/named) untouched", () => {
    const out = sanitizeSvgLogo(wrap('<rect fill="#0d9488" stroke="red" />'));

    expect(out).toContain('fill="#0d9488"');
    expect(out).toContain('stroke="red"');
  });

  it("prefers an existing RGB fallback over an unconvertible modern color", () => {
    const out = sanitizeSvgLogo(
      wrap(
        '<rect style="fill: #123456; fill: color-mix(in srgb, red, blue)" />',
      ),
    );

    expect(out).toContain("#123456");
    expect(out).not.toMatch(/color-mix/iu);
  });

  it("rejects SVGs containing a <text> element", () => {
    expect(rejectionReason(wrap("<text>Muster</text>"))).toBe("text");
  });

  it("rejects SVGs containing a font definition", () => {
    expect(rejectionReason(wrap('<font-face font-family="Eigen" />'))).toBe(
      "text",
    );
  });

  it("drops a font-family attribute on a shape", () => {
    const out = sanitizeSvgLogo(
      wrap('<rect font-family="Arial" fill="red" />'),
    );

    expect(out).not.toMatch(/font-family/iu);
    expect(out).toContain('fill="red"');
  });

  it("rejects a <script> element", () => {
    expect(rejectionReason(wrap("<script>alert(1)</script><rect />"))).toBe(
      "forbidden",
    );
  });

  it("rejects a script element hidden behind a foreign namespace prefix", () => {
    const svg = wrap(
      '<x:script xmlns:x="http://www.w3.org/2000/svg">alert(1)</x:script>',
    );

    expect(rejectionReason(svg)).toBe("forbidden");
  });

  it("rejects inline event handlers", () => {
    expect(rejectionReason(wrap('<rect onload="alert(1)" />'))).toBe(
      "forbidden",
    );
  });

  it("rejects a script URL that only appears after character references are resolved", () => {
    expect(
      rejectionReason(wrap('<image href="java&#9;script:alert(1)" />')),
    ).toBe("forbidden");
  });

  it("rejects a doctype with an internal subset", () => {
    const svg =
      '<!DOCTYPE svg [<!ENTITY payload "<rect />">]><svg xmlns="http://www.w3.org/2000/svg">&payload;</svg>';

    expect(rejectionReason(svg)).toBe("forbidden");
  });

  it("accepts a plain doctype without an internal subset", () => {
    const out = sanitizeSvgLogo(
      '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n<svg xmlns="http://www.w3.org/2000/svg"><rect fill="red" /></svg>',
    );

    expect(out).toContain('<rect fill="red"/>');
  });

  it("rejects external references on an image", () => {
    const svg = wrap('<image href="https://example.test/logo.png" />');

    expect(rejectionReason(svg)).toBe("forbidden");
  });

  it("keeps an embedded raster image", () => {
    const out = sanitizeSvgLogo(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="data:image/png;base64,AAA" /></svg>',
    );

    expect(out).toContain('href="data:image/png;base64,AAA"');
  });

  it("rejects elements that react-pdf cannot draw", () => {
    expect(rejectionReason(wrap('<mask id="m"><rect /></mask>'))).toBe(
      "forbidden",
    );
    expect(rejectionReason(wrap('<use href="#a" />'))).toBe("forbidden");
  });

  it("keeps a paint server reference but drops one pointing elsewhere", () => {
    const out = sanitizeSvgLogo(
      wrap(
        '<linearGradient id="a"><stop offset="0" stop-color="red" /></linearGradient><rect fill="url(#a)" /><circle fill="url(https://example.test/p.svg#a)" />',
      ),
    );

    expect(out).toContain('fill="url(#a)"');
    expect(out).toContain("<circle/>");
  });

  it("drops metadata and annotations left behind by drawing programs", () => {
    const out = sanitizeSvgLogo(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:serif="http://www.serif.com/" xml:space="preserve"><title>Logo</title><metadata><custom xmlns="urn:x-test">ignoriert</custom></metadata><rect serif:id="Ebene" data-name="rect" fill="red" /></svg>',
    );

    expect(out).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="red"/></svg>',
    );
  });

  it("moves a loose gradient into a root <defs> so url() refs resolve", () => {
    const out = sanitizeSvgLogo(
      wrap(
        '<g><linearGradient id="a"><stop offset="0" stop-color="red" /></linearGradient><rect fill="url(#a)" /></g>',
      ),
    );

    expect(out).toMatch(/^<svg[^>]*><defs><linearGradient id="a">/u);
  });

  it("merges multiple root <defs> into one", () => {
    const out = sanitizeSvgLogo(
      wrap(
        '<defs><linearGradient id="a"><stop offset="0" stop-color="red" /></linearGradient></defs><defs><clipPath id="b"><rect /></clipPath></defs><rect fill="url(#a)" />',
      ),
    );

    expect(out.match(/<defs>/gu)).toHaveLength(1);
    expect(out).toContain('<linearGradient id="a">');
    expect(out).toContain('<clipPath id="b">');
  });

  it("adds the SVG namespace when the file omits it", () => {
    const out = sanitizeSvgLogo('<svg viewBox="0 0 10 10"><rect /></svg>');

    expect(out).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("throws an invalid error for non-SVG input", () => {
    expect(rejectionReason("<html><body>nope</body></html>")).toBe("invalid");
  });

  it("throws an invalid error for malformed XML", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect>';

    expect(rejectionReason(svg)).toBe("invalid");
  });

  it("escapes special characters in attribute values", () => {
    const out = sanitizeSvgLogo(wrap('<rect id="a&quot;&lt;b" />'));

    expect(out).toContain('id="a&quot;&lt;b"');
  });
});
