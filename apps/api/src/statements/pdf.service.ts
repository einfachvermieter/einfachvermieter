import { readFile } from "node:fs/promises";
import {
  type OperatingCostStatement,
  OperatingCostStatementSchema,
  UnitSchema,
} from "@einfachvermieter/db";
import {
  appLogoPath,
  type StatementDocumentProps,
} from "@einfachvermieter/pdf";
import {
  byName,
  formatName,
  formatStatementReference,
  type StatementResult,
  statementResultSchema,
  todayIso,
  toLogoAlignment,
  toLogoMode,
  toLogoScalePercent,
} from "@einfachvermieter/shared";
import { EntityManager } from "@mikro-orm/core";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { BuildingsService } from "../buildings/buildings.service.js";
import { renderStatementDocument } from "../common/pdf-worker.js";
import { SettingsService } from "../settings/settings.service.js";
import {
  STATEMENT_STORAGE,
  StorageService,
} from "../storage/storage.service.js";
import { TenantsService } from "../tenants/tenants.service.js";
import { UnitsService } from "../units/units.service.js";
import { StatementsService } from "./statements.service.js";

const FAR_FUTURE = "9999-12-31";

type StatementRow = OperatingCostStatement;

@Injectable()
export class PdfService {
  constructor(
    private readonly em: EntityManager,
    private readonly statementsService: StatementsService,
    private readonly buildingsService: BuildingsService,
    private readonly unitsService: UnitsService,
    private readonly tenantsService: TenantsService,
    private readonly settingsService: SettingsService,
    @Inject(STATEMENT_STORAGE) private readonly storage: StorageService,
  ) {}

  /**
   * Rendert das NK-Statement-PDF aus der aktuellen DB-Sicht (Draft -> live
   * berechnet; finalized -> aus dem Snapshot).
   */
  async renderForStatement(statementId: string): Promise<Buffer> {
    const statement = await this.statementsService.get(statementId);
    const result = await this.resolveResult(statement);
    const meta = await this.buildMeta(statement);

    return renderStatementDocument({ result, meta });
  }

  /**
   * Rendert das PDF und persistiert es im Storage. Setzt `pdfPath` auf der
   * Statement-Row. Wird vom Finalize-Pfad nach der Snapshot-Persistierung
   * aufgerufen.
   *
   * Wirft, wenn der Render fehlschlägt. Der Aufrufer entscheidet, ob das
   * den Gesamtablauf abbrechen soll. Aktuell loggt der Controller den
   * Fehler und gibt das (bereits finalisierte) Statement trotzdem zurück.
   */
  async persistForStatement(statementId: string): Promise<string> {
    const buffer = await this.renderForStatement(statementId);

    const storageKey = `${statementId}.pdf`;

    await this.storage.write(storageKey, buffer);

    await this.em.nativeUpdate(
      OperatingCostStatementSchema,
      { id: statementId },
      { pdfPath: storageKey, updatedAt: new Date().toISOString() },
    );

    return storageKey;
  }

  /**
   * Liefert das StatementResult für die PDF: nur Entwürfe werden live
   * berechnet. Sobald eine Abrechnung finalisiert war, kommen die Zahlen aus
   * dem persistierten Snapshot (strikt geparst) - auch nach Storno oder
   * Ersetzung durch eine Korrektur. Diese Dokumente sind beim Mieter und
   * dürfen sich nicht mehr ändern, wenn später Zahlungen oder Rechnungen
   * nachgetragen werden.
   */
  private async resolveResult(
    statement: StatementRow,
  ): Promise<StatementResult> {
    if (statement.status === "draft") {
      return await this.statementsService.calculateForStatement(statement);
    }

    if (!statement.snapshotData) {
      throw new NotFoundException(
        `Statement ${statement.id} (${statement.status}) has no snapshot`,
      );
    }

    // `safeParse` würde stille Defaults zulassen. Wir wollen einen Fehler,
    // wenn der Snapshot strukturell nicht stimmt, damit der Endpoint einen
    // 500 zurückgibt statt ein kaputtes PDF zu rendern.
    return statementResultSchema.parse(statement.snapshotData);
  }

  /**
   * Stellt die nicht-rechnerischen Kopfdaten der PDF zusammen: Gebäude-,
   * Mieter- und Absenderangaben, Wohnungsbezug, Abrechnungs-Referenz sowie
   * Bankverbindungs-/SEPA-Status zum Periodenende.
   */
  private async buildMeta(
    statement: StatementRow,
  ): Promise<StatementDocumentProps["meta"]> {
    const building = await this.buildingsService.get(statement.buildingId);
    const tenantAggregate = await this.tenantsService.getAggregate(
      statement.tenantId,
    );
    const unit = await this.unitsService.get(tenantAggregate.tenant.unitId);
    const senderSettings = await this.settingsService.getSenderSettings();

    const buildingUnits = await this.em.find(
      UnitSchema,
      { buildingId: statement.buildingId },
      { fields: ["areaSqm"] },
    );

    const buildingTotalAreaSqm = buildingUnits.reduce(
      (sum, u) => sum + u.areaSqm,
      0,
    );

    const contractParties = tenantAggregate.residents.filter(
      (r) => r.isContractParty,
    );

    const tenantName =
      contractParties.length > 0
        ? contractParties
            .sort(byName)
            .map((r) => formatName(r.firstName, r.lastName))
            .filter(Boolean)
            .join(", ")
        : "";

    const today = todayIso();

    const activeTenantAddress = tenantAggregate.addresses.find((address) => {
      const start = address.startDate ?? statement.periodStart;
      const end = address.endDate ?? FAR_FUTURE;
      return start <= today && end >= today;
    });

    const bankAccountValidAtPeriodEnd = (bank: {
      startDate: string | null;
      endDate: string | null;
    }) => {
      const start = bank.startDate ?? statement.periodStart;
      const end = bank.endDate ?? statement.periodEnd;
      return start <= statement.periodEnd && end >= statement.periodEnd;
    };

    const hasBankAccount = tenantAggregate.bankAccounts.some(
      bankAccountValidAtPeriodEnd,
    );

    const hasSepaMandate = tenantAggregate.bankAccounts.some((bank) => {
      if (!(bank.mandateReference && bank.mandateSignedAt)) {
        return false;
      }
      return bankAccountValidAtPeriodEnd(bank);
    });

    const periodYear = Number(statement.periodStart.slice(0, 4));
    const statementReference = formatStatementReference(
      periodYear,
      statement.sequenceNumber,
      statement.revisionNumber,
    );

    // Korrekturabrechnung: Referenz der ersetzten Abrechnung auflösen, damit
    // die PDF den Korrekturhinweis ausweisen kann.
    let correctionOfReference: string | null = null;
    if (statement.supersedesStatementId) {
      const superseded = await this.em.findOne(OperatingCostStatementSchema, {
        id: statement.supersedesStatementId,
      });

      if (superseded) {
        correctionOfReference = formatStatementReference(
          Number(superseded.periodStart.slice(0, 4)),
          superseded.sequenceNumber,
          superseded.revisionNumber,
        );
      }
    }

    const logo = await this.resolveSenderLogo(senderSettings);

    return {
      buildingName: building.name,
      buildingAddress: `${building.addressStreet}, ${building.addressPostalCode} ${building.addressCity}`,
      tenantName,
      tenantAddressStreet:
        activeTenantAddress?.street ?? building.addressStreet,
      tenantAddressCity: activeTenantAddress
        ? `${activeTenantAddress.postalCode} ${activeTenantAddress.city}`
        : `${building.addressPostalCode} ${building.addressCity}`,
      unitName: unit.name,
      unitNumber: unit.unitNumber,
      unitAreaSqm: unit.areaSqm,
      buildingTotalAreaSqm,
      statementReference,
      isDraft: statement.status === "draft",
      correctionOfReference,
      senderName: senderSettings.senderName,
      senderAddressStreet: senderSettings.senderAddressStreet,
      senderAddressPostalCode: senderSettings.senderAddressPostalCode,
      senderAddressCity: senderSettings.senderAddressCity,
      senderPhone: senderSettings.senderPhone ?? null,
      senderFax: senderSettings.senderFax ?? null,
      senderEmail: senderSettings.senderEmail ?? null,
      senderBankName: senderSettings.senderBankName ?? null,
      senderBankIban: senderSettings.senderBankIban ?? null,
      senderBankBic: senderSettings.senderBankBic ?? null,
      senderLogoUrl: logo.url,
      senderLogoAspectRatio: logo.aspectRatio,
      senderLogoAlignment: toLogoAlignment(senderSettings.logoAlignment),
      senderLogoScalePercent: toLogoScalePercent(
        senderSettings.logoScalePercent,
      ),
      documentDate: statement.documentDate ?? today,
      hasSepaMandate,
      hasBankAccount,
    };
  }

  /**
   * Auflösung des Logos als data-URI, je nach gewähltem Modus: das
   * hochgeladene Logo, das App-Logo aus dem packages/pdf-Asset-Ordner
   * oder keines. Fehlt der Upload, bleibt der Briefkopf leer. Bei SVG
   * kommt das Seitenverhältnis mit, sonst lässt es sich nicht ausrichten.
   */
  private async resolveSenderLogo(senderSettings: {
    logoMode: string;
  }): Promise<{ url: string | null; aspectRatio: number | null }> {
    const mode = toLogoMode(senderSettings.logoMode);
    if (mode === "none") {
      return { url: null, aspectRatio: null };
    }

    if (mode === "own") {
      const logo = await this.settingsService.loadLogo();
      if (!logo) {
        return { url: null, aspectRatio: null };
      }

      return {
        url: toDataUri(logo.data, logo.mimeType),
        aspectRatio:
          logo.mimeType === SVG_MIME
            ? svgAspectRatio(logo.data.toString("utf8"))
            : null,
      };
    }

    const data = await readFile(appLogoPath);
    return {
      url: toDataUri(data, SVG_MIME),
      aspectRatio: svgAspectRatio(data.toString("utf8")),
    };
  }
}

const SVG_MIME = "image/svg+xml";

/**
 * Breite geteilt durch Höhe aus der viewBox (bevorzugt) oder den
 * width/height-Attributen. Ohne brauchbare Angabe null.
 */
const VIEW_BOX_PATTERN =
  /viewBox\s*=\s*["']\s*[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)/iu;
const WIDTH_PATTERN = /\bwidth\s*=\s*["']([\d.]+)/iu;
const HEIGHT_PATTERN = /\bheight\s*=\s*["']([\d.]+)/iu;

const svgAspectRatio = (svg: string): number | null => {
  const viewBox = VIEW_BOX_PATTERN.exec(svg);
  if (viewBox) {
    const boxWidth = Number(viewBox[1]);
    const boxHeight = Number(viewBox[2]);
    if (boxWidth > 0 && boxHeight > 0) {
      return boxWidth / boxHeight;
    }
  }

  const width = Number(WIDTH_PATTERN.exec(svg)?.[1]);
  const height = Number(HEIGHT_PATTERN.exec(svg)?.[1]);
  return width > 0 && height > 0 ? width / height : null;
};

/**
 * Binärdaten als base64-data-URI kodieren (zum Einbetten ins PDF).
 */
const toDataUri = (data: Buffer | string, mimeType: string): string =>
  `data:${mimeType};base64,${Buffer.from(data).toString("base64")}`;
