/**
 * Meldung im ASCII-Rahmen
 */
export const framed = (lines: string[]): string => {
  const width = Math.max(...lines.map((line) => line.length));
  const border = `+${"-".repeat(width + 2)}+`;
  const body = lines.map((line) => `| ${line.padEnd(width)} |`);

  return [border, ...body, border].join("\n");
};
