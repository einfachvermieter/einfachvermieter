import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openApiLog, readApiLogs } from "./api-log-file.js";

describe("openApiLog", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "api-log-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("entfernt Farbsteuerzeichen", () => {
    const writeLog = openApiLog(dir);
    writeLog("[32mLOG[39m gestartet\n");

    expect(readApiLogs(dir).current).toBe("LOG gestartet\n");
  });

  it("sichert beim nächsten Start das vorherige Protokoll", () => {
    openApiLog(dir)("erster Start\n");
    openApiLog(dir)("zweiter Start\n");

    expect(readApiLogs(dir)).toEqual({
      current: "zweiter Start\n",
      previous: "erster Start\n",
    });
  });

  it("meldet ein leeres Protokoll als fehlend", () => {
    openApiLog(dir);

    expect(readApiLogs(dir)).toEqual({ current: null, previous: null });
  });

  it("begrenzt Anzahl und Größe der Dateien", () => {
    const line = `${"x".repeat(999)}\n`;

    for (let start = 0; start < 2; start++) {
      const writeLog = openApiLog(dir);
      for (let index = 0; index < 5000; index++) {
        writeLog(line);
      }
    }

    const files = readdirSync(dir).sort();
    expect(files).toEqual(["api.log", "api.log.1", "api.previous.log"]);
    for (const file of files) {
      expect(statSync(join(dir, file)).size).toBeLessThanOrEqual(2_001_000);
    }

    const logs = readApiLogs(dir);
    expect(logs.current?.length).toBe(200_000);
    expect(logs.previous?.length).toBe(200_000);
  });

  it("verwirft beim Start den umgelegten Teil des vorherigen Laufs", () => {
    const line = `${"x".repeat(999)}\n`;
    const writeLog = openApiLog(dir);
    for (let index = 0; index < 2500; index++) {
      writeLog(line);
    }

    openApiLog(dir);

    expect(readdirSync(dir).sort()).toEqual(["api.log", "api.previous.log"]);
  });
});
