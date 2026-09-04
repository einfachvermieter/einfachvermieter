import {
  APP_SETTINGS_ID,
  AppSettingsSchema,
  BuildingSchema,
  type ClimateFactor,
  ClimateFactorSchema,
  OperatingCostStatementSchema,
} from "@einfachvermieter/db";
import {
  addDaysIso,
  isoDatePlusOneYear,
  type Period,
} from "@einfachvermieter/shared";
import { EntityManager } from "@mikro-orm/core";
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { getI18n } from "../i18n/i18n.registry.js";
import { notFoundMessage } from "../i18n/notFound.js";

/**
 * Basis-URL der DWD-Klimafaktoren (CC BY 4.0 bzw. GeoNutzV,
 * Quellenvermerk "Deutscher Wetterdienst" steht im § 6a-Anhang).
 * Eine CSV je gleitendem 12-Monats-Fenster: `DatAnf;DatEnd;PLZ;KF`,
 * PLZ ohne führende Nullen, Publikation ~6 Wochen nach Monatsende.
 */
const DWD_BASE_URL =
  "https://opendata.dwd.de/climate_environment/CDC/derived_germany/techn/monthly/climate_correction_factor/recent";

const FETCH_TIMEOUT_MS = 5000;

/**
 * Fehlgeschlagene Abrufe (offline, Fenster noch nicht publiziert) so lange
 * nicht wiederholen - sonst hängt jede Draft-Neuberechnung im Timeout.
 */
const RETRY_BLOCK_MS = 15 * 60 * 1000;

export type ClimateFactorValue = {
  factor: number;
  isManual: boolean;
};

export type ClimateFactorRow = {
  periodStart: string;
  periodEnd: string;
  factor: number | null;
  isManual: boolean;
};

export type ClimateFactorOverview = {
  buildingId: string;
  postalCode: string | null;
  autoFetch: boolean | null;
  rows: ClimateFactorRow[];
};

/**
 * Liefert DWD-Klimafaktoren für die Witterungsbereinigung des
 * Vorperiodenvergleichs (§ 6a Abs. 3 Nr. 5 HeizkostenV): erst aus dem
 * DB-Cache, sonst per Einmal-Abruf von opendata.dwd.de (danach offline
 * verfügbar). Der automatische Abruf läuft nur, wenn der Nutzer ihn in den
 * Einstellungen erlaubt hat (`climateFactorsAutoFetch`).
 * Manuell erfasste Werte liegen als `isManual`-Zeilen im
 * selben Cache. Liefert null, wenn kein Faktor bestimmbar ist;
 * der Vergleich bleibt dann unbereinigt und sagt das im Anhang.
 */
@Injectable()
export class ClimateFactorService {
  private readonly logger = new Logger(ClimateFactorService.name);

  /**
   * Zeitstempel, bis zu dem ein fehlgeschlagener Abruf nicht wiederholt
   * wird, je "postalCode|start|end".
   */
  private readonly retryBlockedUntil = new Map<string, number>();

  constructor(private readonly em: EntityManager) {}

  async getFactor(
    postalCode: string | null | undefined,
    period: Period,
  ): Promise<ClimateFactorValue | null> {
    if (!postalCode || !isTwelveMonthWindow(period)) {
      return null;
    }

    const cached = await this.findCached(postalCode, period);
    if (cached) {
      return { factor: cached.factor, isManual: cached.isManual };
    }

    // Ohne ausdrückliches Ja zum DWD-Abruf verlässt keine Anfrage das
    // Gerät; der Vergleich bleibt dann unbereinigt. Explizites "Neu laden"
    // (reloadFromDwd) bleibt davon unberührt.
    if (!(await this.autoFetchAllowed())) {
      return null;
    }

    const blockKey = `${postalCode}|${period.start}|${period.end}`;
    const blockedUntil = this.retryBlockedUntil.get(blockKey) ?? 0;
    if (Date.now() < blockedUntil) {
      return null;
    }

    const factor = await this.fetchFromDwd(postalCode, period);
    if (factor === null) {
      this.retryBlockedUntil.set(blockKey, Date.now() + RETRY_BLOCK_MS);
      return null;
    }

    await this.storeFactor(postalCode, period, factor, false);

    return { factor, isManual: false };
  }

  /**
   * Klimafaktoren zu einer Abrechnung: der eigene Abrechnungszeitraum und,
   * falls es ein finalisiertes Vorperioden-Statement desselben Mieters
   * gibt, dessen Zeitraum, jeweils mit dem Cache-Stand der Gebäude-PLZ.
   */
  async listForStatement(statementId: string): Promise<ClimateFactorOverview> {
    const statement = await this.em.findOne(OperatingCostStatementSchema, {
      id: statementId,
    });
    if (!statement) {
      throw new NotFoundException(notFoundMessage("statement", statementId));
    }

    const postalCode = await this.postalCodeFor(statement.buildingId);

    const periods: Period[] = [
      { start: statement.periodStart, end: statement.periodEnd },
    ];
    const previous = await this.em.findOne(
      OperatingCostStatementSchema,
      {
        tenantId: statement.tenantId,
        status: "finalized",
        periodEnd: addDaysIso(statement.periodStart, -1),
      },
      { orderBy: { finalizedAt: "desc" } },
    );
    if (previous) {
      periods.push({ start: previous.periodStart, end: previous.periodEnd });
    }

    const rows: ClimateFactorRow[] = [];
    for (const period of periods) {
      const cached = postalCode
        ? await this.findCached(postalCode, period)
        : null;
      rows.push({
        periodStart: period.start,
        periodEnd: period.end,
        factor: cached?.factor ?? null,
        isManual: cached?.isManual ?? false,
      });
    }

    return {
      buildingId: statement.buildingId,
      postalCode,
      autoFetch: await this.autoFetchSetting(),
      rows,
    };
  }

  /**
   * Gespeicherte DWD-Abruf-Entscheidung (null = noch nicht entschieden)
   */
  private async autoFetchSetting(): Promise<boolean | null> {
    const settings = await this.em.findOne(AppSettingsSchema, {
      id: APP_SETTINGS_ID,
    });
    return settings?.climateFactorsAutoFetch ?? null;
  }

  private async autoFetchAllowed(): Promise<boolean> {
    return (await this.autoFetchSetting()) === true;
  }

  /**
   * Manuell erfassten Faktor setzen bzw. einen vorhandenen überschreiben.
   */
  async setManual(
    buildingId: string,
    period: Period,
    factor: number,
  ): Promise<ClimateFactorRow> {
    const postalCode = await this.requirePostalCode(buildingId);
    this.assertTwelveMonthWindow(period);

    await this.storeFactor(postalCode, period, factor, true);

    return {
      periodStart: period.start,
      periodEnd: period.end,
      factor,
      isManual: true,
    };
  }

  /**
   * Faktor frisch vom DWD laden und einen vorhandenen (auch manuellen)
   * Wert überschreiben. Wirft, wenn der DWD den Zeitraum (noch) nicht
   * liefert, dann bleibt der bestehende Wert unverändert.
   */
  async reloadFromDwd(
    buildingId: string,
    period: Period,
  ): Promise<ClimateFactorRow> {
    const postalCode = await this.requirePostalCode(buildingId);
    this.assertTwelveMonthWindow(period);

    const factor = await this.fetchFromDwd(postalCode, period);
    if (factor === null) {
      throw new BadRequestException(
        getI18n().t("ui.heating.climateFactors.reloadFailed"),
      );
    }

    this.retryBlockedUntil.delete(
      `${postalCode}|${period.start}|${period.end}`,
    );
    await this.storeFactor(postalCode, period, factor, false);

    return {
      periodStart: period.start,
      periodEnd: period.end,
      factor,
      isManual: false,
    };
  }

  private findCached(
    postalCode: string,
    period: Period,
  ): Promise<ClimateFactor | null> {
    return this.em.findOne(ClimateFactorSchema, {
      postalCode,
      periodStart: period.start,
      periodEnd: period.end,
    });
  }

  private async storeFactor(
    postalCode: string,
    period: Period,
    factor: number,
    isManual: boolean,
  ): Promise<void> {
    const existing = await this.findCached(postalCode, period);
    if (existing) {
      existing.factor = factor;
      existing.isManual = isManual;
      await this.em.flush();
      return;
    }

    // Fehler beim Persistieren schlucken: parallele Berechnungsläufe können
    // denselben Faktor gleichzeitig holen (Unique auf PLZ + Zeitraum), der
    // Wert selbst ist ja da.
    await this.em
      .insert(ClimateFactorSchema, {
        id: crypto.randomUUID(),
        postalCode,
        periodStart: period.start,
        periodEnd: period.end,
        factor,
        isManual,
      })
      .catch(() => undefined);
  }

  private async postalCodeFor(buildingId: string): Promise<string | null> {
    const building = await this.em.findOne(BuildingSchema, { id: buildingId });
    if (!building) {
      throw new NotFoundException(notFoundMessage("building", buildingId));
    }
    return building.addressPostalCode ?? null;
  }

  private async requirePostalCode(buildingId: string): Promise<string> {
    const postalCode = await this.postalCodeFor(buildingId);
    if (!postalCode) {
      throw new BadRequestException(
        getI18n().t("ui.heating.climateFactors.postalCodeMissing"),
      );
    }
    return postalCode;
  }

  private assertTwelveMonthWindow(period: Period): void {
    if (!isTwelveMonthWindow(period)) {
      throw new BadRequestException(
        getI18n().t("ui.heating.climateFactors.periodNotTwelveMonths"),
      );
    }
  }

  private async fetchFromDwd(
    postalCode: string,
    period: Period,
  ): Promise<number | null> {
    const url = `${DWD_BASE_URL}/KF_${compactDate(period.start)}_${compactDate(period.end)}.csv`;
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.warn(
          `DWD-Klimafaktoren nicht abrufbar (${response.status}): ${url}`,
        );
        return null;
      }

      const csv = await response.text();

      // PLZ in der CSV ohne führende Nullen ("1067" statt "01067").
      const wanted = String(Number.parseInt(postalCode, 10));

      for (const line of csv.split("\n")) {
        const [, , plz, factorRaw] = line.trim().split(";");

        if (plz === wanted && factorRaw) {
          const factor = Number.parseFloat(factorRaw);
          return Number.isFinite(factor) && factor > 0 ? factor : null;
        }
      }

      this.logger.warn(`PLZ ${postalCode} nicht in DWD-Klimafaktoren: ${url}`);

      return null;
    } catch (err) {
      this.logger.warn(`DWD-Klimafaktor-Abruf fehlgeschlagen: ${String(err)}`);

      return null;
    }
  }
}

/**
 * Der DWD publiziert je 12-Monats-Fenster genau eine Datei (Monatserster
 * bis zum Monatsletzten ein Jahr später). Andere Zeiträume haben keine
 * Datei und bleiben unbereinigt.
 */
const isTwelveMonthWindow = (period: Period): boolean =>
  period.start.endsWith("-01") &&
  addDaysIso(period.end, 1) === isoDatePlusOneYear(period.start);

const compactDate = (iso: string): string => iso.replaceAll("-", "");
