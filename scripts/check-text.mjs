#!/usr/bin/env node
// Prüft Textregeln, die Biome nicht abdeckt: erlaubte Zeichen im Code,
// Wortwahl, Form und Platzierung von Kommentaren, Typografie in de.json.
//
// Aufruf:
//   node scripts/check-text.mjs            alle Dateien im Repo
//   node scripts/check-text.mjs a.ts b.ts  nur diese Dateien
//   node scripts/check-text.mjs --hook     Claude-Code-Hook (JSON auf stdin)
//
// Exit 1 bei Verstössen, im Hook-Modus Exit 2.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const codeExtensions = /\.(ts|tsx|mts|cts|js|mjs|cjs|css)$/u;
const scriptExtensions = /\.(ts|tsx|mts|cts|js|mjs|cjs)$/u;
const localeFile = /^packages\/i18n\/src\/locales\/[^/]+\.json$/u;
const publicDocs =
  /^(README|CHANGELOG|CONTRIBUTING|SECURITY)\.md$|^docs\/.*\.md$/u;

// Dateien, deren Inhalt bewusst Typografie oder fremde Wörter enthält.
const excludedPaths = [
  /(^|\/)node_modules\//u,
  /(^|\/)dist\//u,
  /^apps\/desktop\/(staging|release)\//u,
  /^packages\/db\/src\/migrations\//u,
  /^apps\/api\/src\/ai\/prompts\.ts$/u,
  /^scripts\/check-text\.mjs$/u,
];

// Im Code erlaubt: ASCII, Umlaute, ß, Paragraf, Euro, Promille, Grad.
const forbiddenChar = /[^\t\n\r\x20-\x7eäöüÄÖÜß§€‰\u00b0]/gu;

const charHints = {
  "\u2013": "-",
  "\u2014": "-",
  "\u2212": "-",
  "\u2500": "-",
  "\u2550": "=",
  "\u201e": '"',
  "\u201c": '"',
  "\u201d": '"',
  "\u201a": "'",
  "\u2018": "'",
  "\u2019": "'",
  "\u2026": "...",
  "\u00a0": "Leerzeichen bzw. \\u00a0 im String",
  "\u202f": "Leerzeichen bzw. \\u202f im String",
  "\u00b2": "qm für m\u00b2, sonst 2 (cm2)",
  "\u00b3": "3 (m3, cm3)",
  "\u2082": "2 (CO2)",
  "\u00d7": "x bzw. *",
  "\u00b7": "*",
  "\u2192": "->",
  "\u2190": "<-",
  "\u2194": "<->",
  "\u2265": ">=",
  "\u2264": "<=",
  "\u2260": "!=",
  "\u2022": "-",
};

// Wortwahl in Code und Kommentaren: UI-Bausteine heissen wie die Komponente.
const codeWords = [
  [/\b(Tasten?|Knopf|Knöpfe\w*|Schaltfläche\w*)\b/gu, "Button"],
  [/\bKachel\w*/gu, "Icon-Badge, Radio-Card, Link-Tile oder KPI-Tile"],
  [/\bReiter\b/gu, "Tab"],
  [/\bKästchen\b/gu, "Checkbox"],
  [/\bSchalter\w*/gu, "Switch"],
  [/\bUnterseite\w*/gu, "SubSheet"],
  [/\bHinweiskasten\w*/gu, "Alert"],
  [/\breturnt\b/gu, "deutsches Verb (liefert)"],
];

// Wortwahl überall (Code, de.json, öffentliche Doku).
const commonWords = [
  [/\bgetönt\w*/gu, "farbig"],
  [/\b[Kk]lemm(en|t|te[nrs]?|ung(en)?)\b|\bgeklemmt\w*/gu, "begrenzen/kappen"],
  [/\b[Ff]estschreib\w*|\b[Ff]estgeschrieben\w*/gu, "finalisieren"],
  [/\b[Pp]roratier\w*/gu, "anteilig"],
  [/\b[Pp]rivat(e[nrs]?)? ?[Vv]ermieter\w*/gu, "Vermieter (ohne privat)"],
];

const tailwindDefaultPalette =
  /\b(bg|text|border|ring|fill|stroke|from|to|via|outline|divide|decoration|accent|caret)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/gu;

// Nach einem Docblock folgt eine Deklaration, keine Anweisung.
const statementAfterDocblock =
  /^(if|else|for|while|do|switch|return|throw|try|catch|finally|await|break|continue|case|default|import)\b|^[})\]<]/u;

const toRepoPath = (file) =>
  path
    .relative(repoRoot, path.resolve(repoRoot, file))
    .split(path.sep)
    .join("/");

const testFile = /\.(test|spec)\.[cm]?[jt]sx?$|^apps\/api\/test\//u;
const invisibleChar = /[\p{Z}\p{C}]/u;

const isExcluded = (file) =>
  excludedPaths.some((pattern) => pattern.test(file));

// Häufige deutsche Wortstämme, die mit ae/oe/ue umschrieben wurden. Eine
// allgemeine Regel ginge nicht, weil neue, Steuer, value oder true richtig sind.
const transliteratedWord =
  /\b\w*(fuer|ueber|pruef|gehoer|koenn|muess|duerf|moecht|waere|haett|wuerd|aender|schluess|moeglich|uebersetz|verstoe|abkuerz|schuetz|traeg|haeng|faell|taet|praes|hoeh|knuepf|loes|staend|faehr|fuenf|maenn|klaer|woert|naechst|spaet|groess|hoechst|waehrend|gebuehr|gebaeud|waerm|ergaenz|raeum|flaech|schaetz|stueck|oeffn|rueck|zaehl|waehl|fuehr|fueg|laess|haelt|gueltig|naeh|haeufig|taeglich|jaehr|maessig)\w*\b/giu;

const quoteChars = "\"'`";

/**
 * Liefert alle Treffer eines Wort-Musters als Verstöße.
 */
const checkWords = (line, lineNumber, rules, report) => {
  for (const [pattern, hint] of rules) {
    for (const match of line.matchAll(pattern)) {
      report(lineNumber, `"${match[0]}" vermeiden, stattdessen: ${hint}`);
    }
  }
};

/**
 * Meldet umschriebene Umlaute. Routenpfade und Tab-Werte (`/zaehler`,
 * `"uebersicht"`) sind URLs und bleiben ASCII.
 */
const checkTransliteration = (line, lineNumber, report) => {
  for (const match of line.matchAll(transliteratedWord)) {
    const before = line[match.index - 1] ?? "";
    const after = line[match.index + match[0].length] ?? "";
    const isPathPart = [before, after].some(
      (char) => char === "/" || char === "-",
    );
    const isSlugValue =
      before !== "" &&
      after !== "" &&
      quoteChars.includes(before) &&
      quoteChars.includes(after) &&
      /^[a-z]+$/u.test(match[0]);
    if (isPathPart || isSlugValue) {
      continue;
    }
    report(lineNumber, `"${match[0]}" mit Umlaut schreiben (ä, ö, ü, ß)`);
  }
};

/**
 * Prüft Zeichen, Wortwahl und Code-Muster einer Zeile.
 */
const checkCodeLine = (file, line, lineNumber, report) => {
  // Tests prüfen oft formatierten Text: dort sind sichtbare Sonderzeichen
  // in Code-Zeilen erlaubt, unsichtbare Leerzeichen bleiben Escapes.
  const allowVisible = testFile.test(file) && !/^\s*(\/\/|\*|\/\*)/u.test(line);
  for (const match of line.matchAll(forbiddenChar)) {
    const char = match[0];
    if (allowVisible && !invisibleChar.test(char)) {
      continue;
    }
    const code = `U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`;
    const hint = charHints[char] ? `, stattdessen: ${charHints[char]}` : "";
    report(
      lineNumber,
      `Zeichen "${char}" (${code}) gehört nach de.json${hint}`,
    );
  }
  checkWords(line, lineNumber, codeWords, report);
  checkWords(line, lineNumber, commonWords, report);
  checkTransliteration(line, lineNumber, report);
  for (const match of line.matchAll(tailwindDefaultPalette)) {
    report(
      lineNumber,
      `Tailwind-Standardfarbe "${match[0]}", eigene Skalen nutzen (azur, limette, honig, himbeere, schiefer)`,
    );
  }
  if (!scriptExtensions.test(file)) {
    return;
  }
  if (/\bReact\.[A-Za-z]/u.test(line) && !/^\s*(\/\/|\*)/u.test(line)) {
    report(
      lineNumber,
      "Kein React.-Zugriff, Funktion oder Typ benannt importieren",
    );
  }
  if (
    /docs-internal\//u.test(line) &&
    !file.startsWith("scripts/") &&
    !file.startsWith(".claude/")
  ) {
    report(lineNumber, "Keine Verweise auf docs-internal im Code");
  }
};

/**
 * Prüft Form und Platzierung der Kommentare in einer Skript-Datei.
 */
const checkComments = (file, lines, report) => {
  const isTsx = file.endsWith(".tsx");
  let index = 0;
  while (index < lines.length) {
    const trimmed = lines[index].trim();
    if (trimmed.startsWith("/**")) {
      index = checkDocblock(lines, index, isTsx, report);
    } else if (trimmed.startsWith("/*")) {
      report(
        index + 1,
        "Block-Kommentar /* */ nur als Docblock /** */, sonst //",
      );
    } else if (isTsx && trimmed.includes("<!--")) {
      report(index + 1, "HTML-Kommentar in TSX, stattdessen {/* */}");
    }
    index += 1;
  }
};

/**
 * Prüft einen Docblock ab seiner Startzeile und liefert den Index der
 * Schlusszeile.
 */
const checkDocblock = (lines, startIndex, isTsx, report) => {
  const opening = lines[startIndex].trim();
  if (/^\/\*\*.*\*\/$/u.test(opening)) {
    // In .tsx einzeilig nur an Props und Type-Membern (eingerückt).
    if (!(isTsx && /^\s/u.test(lines[startIndex]))) {
      report(
        startIndex + 1,
        "Docblock mehrzeilig schreiben: /** allein, Text, */ allein",
      );
    }
    checkAfterDocblock(lines, startIndex, report);
    return startIndex;
  }
  if (opening !== "/**") {
    report(startIndex + 1, "Docblock-Anfang /** steht allein in seiner Zeile");
  }
  let index = startIndex + 1;
  while (index < lines.length && !lines[index].includes("*/")) {
    if (!lines[index].trim().startsWith("*")) {
      report(index + 1, "Docblock-Zeilen beginnen mit *");
    }
    index += 1;
  }
  const closing = (lines[index] ?? "").trim();
  if (closing !== "*/") {
    report(index + 1, "Docblock-Ende */ steht allein in seiner Zeile");
  } else if (index - startIndex < 2) {
    report(startIndex + 1, "Docblock ohne Inhalt");
  }
  // Datei-Kopf: ganz oben (höchstens nach einer Shebang-Zeile) und mit
  // Leerzeile danach erlaubt.
  const isFileHead =
    startIndex === 0 || (startIndex === 1 && lines[0].startsWith("#!"));
  if (isFileHead && (lines[index + 1] ?? "").trim() === "") {
    return index;
  }
  checkAfterDocblock(lines, index, report);
  return index;
};

/**
 * Prüft, worauf ein Docblock folgt: direkt eine Deklaration, keine
 * Leerzeile, kein zweiter Docblock und keine Anweisung. Ein Datei-Kopf
 * gilt nur mit Leerzeile danach.
 */
const checkAfterDocblock = (lines, closeIndex, report) => {
  let nextIndex = closeIndex + 1;
  while (
    nextIndex < lines.length &&
    /^\s*\/\/ biome-ignore/u.test(lines[nextIndex])
  ) {
    nextIndex += 1;
  }
  const next = (lines[nextIndex] ?? "").trim();
  const lineNumber = closeIndex + 1;
  if (next === "") {
    report(
      lineNumber,
      "Docblock steht vor einer Leerzeile; an die Deklaration setzen oder // nutzen",
    );
  } else if (next.startsWith("/**")) {
    report(
      lineNumber,
      "Zwei Docblocks hintereinander; einer gehört woanders hin",
    );
  } else if (next.startsWith("//") || next.startsWith("/*")) {
    report(
      lineNumber,
      "Docblock steht vor einem Kommentar statt vor einer Deklaration",
    );
  } else if (statementAfterDocblock.test(next)) {
    report(
      lineNumber,
      "Docblock vor einer Anweisung; hier // nutzen (Datei-Kopf: Leerzeile danach)",
    );
  }
};

/**
 * Prüft Typografie und Wortwahl in den Übersetzungsdateien.
 */
const checkLocaleFile = (lines, report) => {
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const valueMatch = line.match(/^\s*"[^"]+":\s*"(.*)",?\s*$/u);
    if (!valueMatch) {
      return;
    }
    const value = valueMatch[1];
    checkWords(value, lineNumber, commonWords, report);
    checkTransliteration(value, lineNumber, report);
    if (
      /(\d|\})[ \u202f](%|‰|€|kWh|MWh|kW|m\u00b2|m\u00b3|\u00b0C)(?![\p{L}])/u.test(
        value,
      )
    ) {
      report(
        lineNumber,
        "Zwischen Zahl und Einheit gehört U+00A0 (geschütztes Leerzeichen)",
      );
    }
    if (/\b\p{L}\.[ \u00a0]\p{L}\./u.test(value)) {
      report(
        lineNumber,
        "In Abkürzungen wie z. B. gehört U+202F (schmales Leerzeichen)",
      );
    }
    if (/§§?[ \u00a0]\d/u.test(value)) {
      report(lineNumber, "Nach § gehört U+202F (schmales Leerzeichen)");
    }
    if (value.includes("\u2014") && value !== "\u2014") {
      report(
        lineNumber,
        "Geviertstrich nur als Platzhalter für leere Werte, sonst Halbgeviertstrich",
      );
    }
    if (
      /\b(du|dich|dir|dein(e[mnrs]?)?|euch|euer|eure[mnrs]?)\b/iu.test(value)
    ) {
      report(lineNumber, "Sie-Form verwenden, nie du");
    }
  });
};

/**
 * Prüft eine Datei und liefert die Meldungen.
 */
const checkFile = (file) => {
  const messages = [];
  if (isExcluded(file) || !existsSync(path.join(repoRoot, file))) {
    return messages;
  }
  const isCode = codeExtensions.test(file);
  const isLocale = localeFile.test(file);
  const isPublicDoc = publicDocs.test(file);
  if (!(isCode || isLocale || isPublicDoc)) {
    return messages;
  }
  const lines = readFileSync(path.join(repoRoot, file), "utf8").split("\n");
  const report = (lineNumber, message) =>
    messages.push(`${file}:${lineNumber}: ${message}`);
  if (isCode) {
    for (const [index, line] of lines.entries()) {
      checkCodeLine(file, line, index + 1, report);
    }
    if (scriptExtensions.test(file)) {
      checkComments(file, lines, report);
    }
  } else if (isLocale) {
    checkLocaleFile(lines, report);
  } else {
    lines.forEach((line, index) => {
      checkWords(line, index + 1, commonWords, report);
      checkTransliteration(line, index + 1, report);
      if (/[\u2013\u2014]/u.test(line)) {
        report(index + 1, "Keine Gedankenstriche in Markdown-Doku");
      }
    });
  }
  return messages;
};

const listRepoFiles = () =>
  execFileSync("git", ["ls-files", "-co", "--exclude-standard"], {
    cwd: repoRoot,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);

const runHook = () => {
  let filePath;
  try {
    filePath = JSON.parse(readFileSync(0, "utf8")).tool_input?.file_path;
  } catch {
    return 0;
  }
  if (!filePath) {
    return 0;
  }
  const file = toRepoPath(filePath);
  if (file === ".." || file.startsWith("../")) {
    return 0;
  }
  const messages = checkFile(file);
  if (messages.length === 0) {
    return 0;
  }
  process.stderr.write(
    `Textregeln verletzt (scripts/check-text.mjs), bitte korrigieren:\n${messages.slice(0, 40).join("\n")}\n`,
  );
  return 2;
};

const runCli = (fileArgs) => {
  const files =
    fileArgs.length > 0 ? fileArgs.map(toRepoPath) : listRepoFiles();
  const messages = files.flatMap(checkFile);
  if (messages.length === 0) {
    return 0;
  }
  process.stderr.write(
    `${messages.join("\n")}\n\n${messages.length} Verstösse gegen Textregeln\n`,
  );
  return 1;
};

const args = process.argv.slice(2);
process.exitCode = args[0] === "--hook" ? runHook() : runCli(args);
