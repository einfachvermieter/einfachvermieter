import { describe, expect, it } from "vitest";
import { SvgSanitizeError, sanitizeSvgLogo } from "./sanitize-svg.js";

const wrap = (inner: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">${inner}</svg>`;

/**
 * Führt `fn` aus und liefert den geworfenen Fehler zurück (oder undefined).
 */
const captureError = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (error) {
    return error;
  }
};

describe("sanitizeSvgLogo", () => {
  it("converts modern color functions to RGB in presentation attributes", () => {
    const out = sanitizeSvgLogo(wrap('<rect fill="oklch(0.7 0.15 250)" />'));
    expect(out).not.toMatch(/oklch/iu);
    expect(out).toMatch(/fill="(#[0-9a-f]{6}|rgba?\()/iu);
  });

  it("leaves supported colors (hex/rgb/named) untouched", () => {
    const out = sanitizeSvgLogo(wrap('<rect fill="#0d9488" stroke="red" />'));
    expect(out).toMatch(/fill="#0d9488"/u);
    expect(out).toMatch(/stroke="red"/u);
  });

  it("prefers an existing RGB fallback over an unconvertible modern color", () => {
    // Zweite Deklaration ist Unsinn -> Fallback der ersten bleibt erhalten.
    const out = sanitizeSvgLogo(
      wrap('<rect style="fill: #123456; fill: oklch(nonsense)" />'),
    );
    expect(out).toMatch(/fill:\s*#123456/u);
  });

  it("rejects SVGs containing a <text> element", () => {
    const error = captureError(() =>
      sanitizeSvgLogo(wrap("<text>Muster</text>")),
    );
    expect(error).toBeInstanceOf(SvgSanitizeError);
    expect((error as SvgSanitizeError).reason).toBe("text");
  });

  it("rejects SVGs that reference a font-family", () => {
    expect(() =>
      sanitizeSvgLogo(wrap('<rect font-family="Arial" />')),
    ).toThrowError(SvgSanitizeError);
  });

  it("strips <script> elements (security hardening)", () => {
    const out = sanitizeSvgLogo(
      wrap('<script>alert(1)</script><rect fill="#000000" />'),
    );
    expect(out).not.toMatch(/<script/iu);
    expect(out).not.toMatch(/alert/u);
  });

  it("strips inline event handlers", () => {
    const out = sanitizeSvgLogo(
      wrap('<rect fill="#000000" onload="evil()" />'),
    );
    expect(out).not.toMatch(/onload/iu);
  });

  it("removes external image references but keeps the graphic", () => {
    const out = sanitizeSvgLogo(
      wrap(
        '<image href="https://evil.example/x.png" /><rect fill="#000000" />',
      ),
    );
    expect(out).not.toMatch(/evil\.example/u);
    expect(out).toMatch(/<rect/u);
  });

  it("moves a loose gradient into a root <defs> so url() refs resolve", () => {
    const out = sanitizeSvgLogo(
      wrap(
        '<linearGradient id="a"><stop offset="0" stop-color="#0369a1"/><stop offset="1" stop-color="#0d9488"/></linearGradient><rect fill="url(#a)" />',
      ),
    );
    // Gradient sitzt jetzt im <defs>, die url()-Referenz bleibt erhalten.
    expect(out).toMatch(/<defs>\s*<linearGradient id="a"/u);
    expect(out).toMatch(/fill="url\(#a\)"/u);
  });

  it("merges multiple root <defs> into one", () => {
    const out = sanitizeSvgLogo(
      wrap(
        '<defs><linearGradient id="a"><stop offset="0" stop-color="#000"/></linearGradient></defs><defs><radialGradient id="b"><stop offset="0" stop-color="#fff"/></radialGradient></defs><rect fill="url(#a)" stroke="url(#b)" />',
      ),
    );
    expect(out.match(/<defs>/gu)?.length).toBe(1);
    expect(out).toMatch(/id="a"/u);
    expect(out).toMatch(/id="b"/u);
  });

  it("throws an invalid error for non-SVG input", () => {
    const error = captureError(() =>
      sanitizeSvgLogo("<html><body>nope</body></html>"),
    );
    expect(error).toBeInstanceOf(SvgSanitizeError);
    expect((error as SvgSanitizeError).reason).toBe("invalid");
  });
});
