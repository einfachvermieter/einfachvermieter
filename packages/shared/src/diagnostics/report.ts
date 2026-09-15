/**
 * Abschnitt eines Fehlerberichts: Leerzeile, unterstrichener Titel, Inhalt
 */
export const reportSection = (title: string, body: string): string[] => [
  "",
  title,
  "-".repeat(title.length),
  body,
];

const pad = (value: number): string => String(value).padStart(2, "0");

/**
 * Zeitstempel für den Dateinamen eines Fehlerberichts, z. B. `2026-09-16-1430`
 */
export const reportFileStamp = (value: Date): string =>
  [
    `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`,
    `${pad(value.getHours())}${pad(value.getMinutes())}`,
  ].join("-");
