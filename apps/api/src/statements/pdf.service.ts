import { readFile } from "node:fs/promises";
import {
  type OperatingCostStatement,
  OperatingCostStatementSchema,
  UnitSchema,
} from "@einfachvermieter/db";
import {
  appLogoPath,
  geistNormalPath,
  geistSemiboldPath,
  geistTnumNormalPath,
  geistTnumSemiboldPath,
  StatementDocument,
  type StatementDocumentProps,
} from "@einfachvermieter/pdf";
import {
  formatName,
  formatStatementReference,
  type StatementResult,
  statementResultSchema,
  todayIso,
} from "@einfachvermieter/shared";
import { EntityManager } from "@mikro-orm/core";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { type DocumentProps, Font, renderToBuffer } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { BuildingsService } from "../buildings/buildings.service.js";
import { SettingsService } from "../settings/settings.service.js";
import {
  STATEMENT_STORAGE,
  StorageService,
} from "../storage/storage.service.js";
import { TenantsService } from "../tenants/tenants.service.js";
import { UnitsService } from "../units/units.service.js";
import { StatementsService } from "./statements.service.js";

const FAR_FUTURE = "9999-12-31";

// Modul-weite Font-Registrierung: react-pdf hält die Font-Registry global,
// mehrfaches `Font.register` ist idempotent. Beim ersten Import des Services
// einmalig ausführen, damit der erste Render-Call nicht erst die Files lädt.
Font.register({
  family: "Geist",
  fonts: [
    { src: geistNormalPath, fontWeight: 400 },
    { src: geistSemiboldPath, fontWeight: 600 },
  ],
});
Font.register({
  family: "Geist Tnum",
  fonts: [
    { src: geistTnumNormalPath, fontWeight: 400 },
    { src: geistTnumSemiboldPath, fontWeight: 600 },
  ],
});

// Selbe Regel wie im Frontend (apps/web/src/lib/pdfFonts.ts): keine
// Hyphenation, sonst trennt react-pdf Tabellen-Zellen mit Bindestrich.
Font.registerHyphenationCallback((word) => [word]);

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

    // `StatementDocument` returnt intern ein `<Document>`-Element, aber
    // dessen Props sind nicht `DocumentProps`. Die react-pdf-Signatur
    // verlangt das aber. Cast über `unknown` weil die Formableitung hier
    // nicht durchgreifen kann.
    const element = createElement(StatementDocument, {
      result,
      meta,
    }) as unknown as ReactElement<DocumentProps>;

    return renderToBuffer(element);
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
   * Liefert das StatementResult für die PDF: bei finalisierten Abrechnungen
   * aus dem persistierten Snapshot (strikt geparst), sonst live berechnet.
   */
  private async resolveResult(
    statement: StatementRow,
  ): Promise<StatementResult> {
    if (statement.status === "finalized") {
      if (!statement.snapshotData) {
        throw new NotFoundException(
          `Finalized statement ${statement.id} has no snapshot`,
        );
      }

      // `safeParse` würde stille Defaults zulassen. Wir wollen einen Fehler,
      // wenn der Snapshot strukturell nicht stimmt, damit der Endpoint einen
      // 500 zurückgibt statt ein kaputtes PDF zu rendern.
      return statementResultSchema.parse(statement.snapshotData);
    }

    return await this.statementsService.calculateForStatement(statement);
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

    const senderLogoUrl = await this.resolveSenderLogo(senderSettings);

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
      senderLogoUrl,
      documentDate: statement.documentDate ?? today,
      hasSepaMandate,
      hasBankAccount,
    };
  }

  /**
   * Auflösung des Logos als data-URI: bei aktivem Sender-Logo den Upload,
   * sonst das App-Default-SVG aus dem packages/pdf-Asset-Ordner.
   */
  private async resolveSenderLogo(senderSettings: {
    useLogo: boolean;
    hasLogo: boolean;
  }): Promise<string | null> {
    if (!senderSettings.useLogo) {
      return null;
    }

    if (senderSettings.hasLogo) {
      const logo = await this.settingsService.loadLogo();
      if (logo) {
        return toDataUri(logo.data, logo.mimeType);
      }
    }

    const data = await readFile(appLogoPath);
    return toDataUri(data, "image/svg+xml");
  }
}

/**
 * Binärdaten als base64-data-URI kodieren (zum Einbetten ins PDF).
 */
const toDataUri = (data: Buffer, mimeType: string): string =>
  `data:${mimeType};base64,${data.toString("base64")}`;
