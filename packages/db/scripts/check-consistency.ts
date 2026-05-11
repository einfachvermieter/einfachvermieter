/**
 * Dev-Konsistenzcheck für fachliche Invarianten, die sich nicht sauber
 * als DB-Constraint abbilden lassen.
 *
 * Dies sollte nach Anpassungen an den Seed-Daten Dateien ausgeführt werden.
 * In der App selbst wird dieses entsprechend beim Speichern direkt geprüft.
 *
 * Prüft:
 *  1) Überlappende Mietverträge (Tenants) pro Unit.
 *  2) Finalisierte Abrechnungen ohne gültige Snapshot-Version.
 *
 * Aufruf:  npm run check:consistency -w @einfachvermieter/db
 * Exit-Code: 0 wenn alles sauber, 1 bei mindestens einem Fund.
 */

import type { EntityManager } from "@mikro-orm/core";
import {
  initOrm,
  OperatingCostStatementSchema,
  TenantSchema,
} from "../src/index.js";

type Finding = {
  level: "error" | "warn";
  area: string;
  message: string;
};

const main = async () => {
  const orm = await initOrm();
  const em = orm.em.fork();
  const findings: Finding[] = [];

  try {
    await checkTenantOverlaps(em, findings);
    await checkFinalizedStatementsHaveVersion(em, findings);
  } finally {
    await orm.close(true);
  }

  const errors = findings.filter((f) => f.level === "error");
  const warnings = findings.filter((f) => f.level === "warn");

  for (const f of findings) {
    const prefix = f.level === "error" ? "FEHLER" : "WARN";
    console.log(`[check-consistency] ${prefix} (${f.area}): ${f.message}`);
  }

  if (findings.length === 0) {
    console.log("[check-consistency] OK - keine Auffälligkeiten.");
    return;
  }
  console.log(
    `[check-consistency] Zusammenfassung: ${errors.length} Fehler, ${warnings.length} Warnungen.`,
  );
  if (errors.length > 0) {
    process.exit(1);
  }
};

const checkTenantOverlaps = async (em: EntityManager, findings: Finding[]) => {
  const tenants = await em.find(TenantSchema, {});
  const byUnit = new Map<string, typeof tenants>();
  for (const t of tenants) {
    const bucket = byUnit.get(t.unitId) ?? [];
    bucket.push(t);
    byUnit.set(t.unitId, bucket);
  }
  for (const [unitId, unitTenants] of byUnit) {
    const sorted = [...unitTenants].sort((a, b) =>
      a.startDate.localeCompare(b.startDate),
    );
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i];
        const b = sorted[j];
        if (!a || !b) {
          continue;
        }
        const aEnd = a.endDate ?? "9999-12-31";
        const bEnd = b.endDate ?? "9999-12-31";
        const overlaps = a.startDate <= bEnd && b.startDate <= aEnd;
        if (overlaps) {
          findings.push({
            level: "error",
            area: "tenants",
            message: `Unit ${unitId} hat überlappende Mietverträge ${a.id} (${a.startDate}...${a.endDate ?? "unbefristet"}) und ${b.id} (${b.startDate}...${b.endDate ?? "unbefristet"}).`,
          });
        }
      }
    }
  }
};

const checkFinalizedStatementsHaveVersion = async (
  em: EntityManager,
  findings: Finding[],
) => {
  const statements = await em.find(OperatingCostStatementSchema, {});
  for (const s of statements) {
    if (s.status !== "finalized") {
      continue;
    }
    const snap = s.snapshotData;
    if (!snap) {
      findings.push({
        level: "error",
        area: "statements",
        message: `Finalized Statement ${s.id} (Tenant ${s.tenantId}, ${s.periodStart}...${s.periodEnd}) hat keinen Snapshot.`,
      });
      continue;
    }
    const { version } = snap as { version?: unknown };
    if (typeof version !== "number" || version < 1) {
      findings.push({
        level: "warn",
        area: "statements",
        message: `Finalized Statement ${s.id} (Tenant ${s.tenantId}) hat keine gültige Snapshot-Version (aktuell: ${String(version)}). PDF (Altbestand) bleibt gültig, aber Reporting sollte diesen Fall kennen.`,
      });
    }
  }
};

main().catch((err) => {
  console.error("[check-consistency] Abbruch:", err);
  process.exit(2);
});
