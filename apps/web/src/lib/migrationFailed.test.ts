import type { MigrationFailure } from "@einfachvermieter/shared";
import { describe, expect, it } from "vitest";
import {
  migrationFailedDetails,
  migrationFailedText,
  migrationFailedTitle,
} from "./migrationFailed";

const failure = (overrides: Partial<MigrationFailure>): MigrationFailure => ({
  lastVersion: "2026.1.0",
  currentVersion: "2026.2.0",
  migration: "Migration20261006163955",
  database: "libsql",
  state: "rolledBack",
  backupFile: null,
  ...overrides,
});

const BACKUP = "2026.2.0-2026-10-11-143000.db";

describe("migrationFailedText", () => {
  it("nennt bei zurückgenommener Migration mit Sicherung Datei und alte Version", () => {
    const text = migrationFailedText(failure({ backupFile: BACKUP }));
    expect(text).toContain("wurde abgebrochen");
    expect(text).toContain(`backups/${BACKUP}`);
    expect(text).toContain("Installieren Sie wieder Version 2026.1.0");
  });

  it("verweist ohne Sicherung der App nur auf die alte Version", () => {
    const text = migrationFailedText(failure({ database: "postgresql" }));
    expect(text).toContain("Starten Sie wieder Version 2026.1.0");
    expect(text).not.toContain("backups/");
  });

  it("verlangt bei unklarem Zustand zuerst die Sicherung der App", () => {
    const text = migrationFailedText(
      failure({ state: "unknown", backupFile: BACKUP }),
    );
    expect(text).toContain("ließ sich nicht feststellen");
    expect(text).toContain(`backups/${BACKUP}`);
    expect(text).toContain("bevor Sie wieder Version 2026.1.0 starten");
  });

  it("verlangt bei unklarem Zustand ohne Sicherung der App die des Betreibers", () => {
    for (const database of ["postgresql", "mariadb"] as const) {
      const text = migrationFailedText(failure({ state: "unknown", database }));
      expect(text).toContain("Spielen Sie Ihre Sicherung der Datenbank");
      expect(text).toContain("darf die alte Version nicht");
    }
  });

  it("nennt bei gescheiterter Sicherung keinen Rückweg zur alten Version", () => {
    const text = migrationFailedText(failure({ state: "backupFailed" }));
    expect(text).toContain("konnte keine Sicherung angelegt werden");
    expect(text).not.toContain("2026.1.0");
  });

  it("sagt „die vorige Version“, wenn die bisherige unbekannt ist", () => {
    for (const overrides of [
      { backupFile: BACKUP },
      {},
      { state: "unknown", backupFile: BACKUP },
      { state: "unknown" },
    ] satisfies Partial<MigrationFailure>[]) {
      const text = migrationFailedText(
        failure({ ...overrides, lastVersion: null }),
      );
      expect(text).toContain("die vorige Version");
      expect(text).not.toContain("{");
      expect(text).not.toContain("ui.migrationFailed");
    }
  });
});

describe("Einrichtung statt Aktualisierung", () => {
  const setup = (overrides: Partial<MigrationFailure>) =>
    failure({ lastVersion: null, state: "setupFailed", ...overrides });

  it("nennt beim Erststart weder Sicherung noch vorige Version", () => {
    for (const database of ["libsql", "postgresql"] as const) {
      const text = migrationFailedText(setup({ database }));
      expect(text).toContain("Die Einrichtung wurde nicht abgeschlossen");
      expect(text).not.toContain("Sicherung");
      expect(text).not.toContain("vorige Version");
      expect(text).not.toContain("neu an");
    }
  });

  it("verlangt beim Erststart auf MariaDB eine neu angelegte Datenbank", () => {
    expect(migrationFailedText(setup({ database: "mariadb" }))).toContain(
      "Legen Sie die Datenbank neu an",
    );
  });

  it("nennt keinen Rückweg, wenn schon Tabellen da waren", () => {
    for (const database of ["libsql", "postgresql", "mariadb"] as const) {
      const text = migrationFailedText(
        setup({ state: "setupBlocked", database }),
      );
      expect(text).toContain("lässt sich nicht sicher feststellen");
      expect(text).not.toContain("neu an");
      expect(text).not.toContain("zurück");
      expect(text).not.toContain("vorige Version");
    }
  });

  it("nennt die Sicherung der App, wenn schon Tabellen da waren", () => {
    const text = migrationFailedText(
      setup({ state: "setupBlocked", backupFile: BACKUP }),
    );
    expect(text).toContain(`backups/${BACKUP}`);
    expect(text).not.toContain("neu an");
  });

  it("trägt den Titel der Einrichtung", () => {
    expect(migrationFailedTitle(setup({}))).toBe("Einrichtung fehlgeschlagen");
    expect(migrationFailedTitle(setup({ state: "setupBlocked" }))).toBe(
      "Einrichtung fehlgeschlagen",
    );
    expect(migrationFailedTitle(failure({}))).toBe(
      "Aktualisierung fehlgeschlagen",
    );
  });
});

describe("migrationFailedDetails", () => {
  it("nennt Migration und Datenbank", () => {
    expect(migrationFailedDetails(failure({ database: "mariadb" }))).toBe(
      "Migration: Migration20261006163955, Datenbank: MariaDB",
    );
  });

  it("nennt ohne Migration nur die Datenbank", () => {
    expect(migrationFailedDetails(failure({ migration: null }))).toBe(
      "Datenbank: SQLite",
    );
  });
});
