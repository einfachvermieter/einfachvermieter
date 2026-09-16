import {
  APP_SETTINGS_ID,
  type AppSettings,
  AppSettingsSchema,
} from "@einfachvermieter/db";
import type {
  AiProvider,
  AiSettingsDto,
  AiSettingsUpdateDto,
  ClimateFactorsSettingsDto,
  ClimateFactorsSettingsUpdateDto,
  InternetSettingsDto,
  InternetSettingsUpdateDto,
  SenderSettingsDto,
  SenderSettingsUpdateDto,
} from "@einfachvermieter/shared";
import {
  toLogoAlignment,
  toLogoMode,
  toLogoScalePercent,
} from "@einfachvermieter/shared";
import { EntityManager } from "@mikro-orm/core";
import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import {
  maskApiKey,
  providersWithEnvApiKey,
  type StoredAiSettings,
} from "../ai/ai-config.js";
import {
  renderLogoDocument,
  sanitizeSvgInWorker,
} from "../common/pdf-worker.js";
import { assertUploadAllowed } from "../common/upload-guard.js";
import { getI18n } from "../i18n/i18n.registry.js";
import { StorageService } from "../storage/storage.service.js";
import { TelemetryService } from "../telemetry/telemetry.service.js";
import { currentAppVersion } from "../updates/app-version.js";
import { SvgSanitizeError, type SvgSanitizeReason } from "./sanitize-svg.js";

/**
 * Meldungen zu den Ablehnungsgründen des SVG-Sanitizers.
 */
const SVG_ERROR_KEYS: Record<SvgSanitizeReason, string> = {
  text: "errors.logoSvgText",
  forbidden: "errors.logoSvgForbidden",
  invalid: "errors.logoSvgInvalid",
};

export const ALLOWED_LOGO_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

const DEFAULT_MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Upload-Limit fürs Briefkopf-Logo. ENV `MAX_LOGO_MB` (positive Ganzzahl)
 * überschreibt den Default.
 */
const parsedLogoMb = Number.parseInt(process.env.MAX_LOGO_MB ?? "", 10);
export const MAX_LOGO_BYTES =
  Number.isFinite(parsedLogoMb) && parsedLogoMb > 0
    ? parsedLogoMb * 1024 * 1024
    : DEFAULT_MAX_LOGO_BYTES;

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

/**
 * Bildet einen eindeutigen Storage-Key fürs Absender-Logo aus der
 * (gesäuberten) Endung.
 */
const storageKeyForLogo = (extension: string): string => {
  const safeExt = extension.replace(/[^a-z0-9]/giu, "").toLowerCase();
  const suffix = safeExt ? `.${safeExt}` : "";
  return `settings/sender-logo-${crypto.randomUUID()}${suffix}`;
};

/**
 * Bettet die Logo-Bytes als Data-URI in ein react-pdf-Vorschaudokument ein
 * und rendert es zu einem PDF-Buffer.
 */
const renderLogoPdf = (data: Buffer, mimeType: string): Promise<Buffer> =>
  renderLogoDocument({
    logoDataUri: `data:${mimeType};base64,${data.toString("base64")}`,
  });

type LogoUploadInput = {
  buffer: Buffer;
  mimetype: string;
  size: number;
};

/**
 * Projiziert die AppSettings-Zeile auf das Absender-DTO.
 *
 * @returns `hasLogo` leitet sich aus dem Storage-Key ab, die Logo-Bytes selbst werden nicht mitgeliefert.
 */
const toDto = (row: AppSettings): SenderSettingsDto => ({
  senderName: row.senderName,
  senderAddressStreet: row.senderAddressStreet,
  senderAddressPostalCode: row.senderAddressPostalCode,
  senderAddressCity: row.senderAddressCity,
  senderPhone: row.senderPhone,
  senderFax: row.senderFax,
  senderEmail: row.senderEmail,
  senderBankName: row.senderBankName,
  senderBankIban: row.senderBankIban,
  senderBankBic: row.senderBankBic,
  logoMode: toLogoMode(row.logoMode),
  logoAlignment: toLogoAlignment(row.logoAlignment),
  logoScalePercent: toLogoScalePercent(row.logoScalePercent),
  hasLogo: row.logoStorageKey !== null,
  logoMimeType: row.logoMimeType,
});

/**
 * Projiziert die AppSettings-Zeile auf das KI-DTO.
 * Der API-Key wird teil-versteckt
 */
const toAiDto = (stored: StoredAiSettings): AiSettingsDto => ({
  aiProvider: (stored.aiProvider as AiProvider | null) ?? null,
  aiBaseUrl: stored.aiBaseUrl,
  aiModel: stored.aiModel,
  hasApiKey: Boolean(stored.aiApiKey),
  apiKeyPreview: maskApiKey(stored.aiApiKey),
  providersWithEnvApiKey: providersWithEnvApiKey(process.env),
});

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly storage: StorageService,
    private readonly telemetry: TelemetryService,
  ) {}

  /**
   * Liefert die Absender-Einstellungen, legt die Zeile bei Bedarf an.
   */
  async getSenderSettings(): Promise<SenderSettingsDto> {
    return toDto(await this.ensureRow());
  }

  /**
   * Aktualisiert die Absender-Stammdaten. Leere Optionalfelder werden auf
   * `null` normalisiert; Logo-Felder bleiben unberührt.
   */
  async updateSenderSettings(
    dto: SenderSettingsUpdateDto,
  ): Promise<SenderSettingsDto> {
    const row = await this.ensureRow();

    this.em.assign(row, {
      senderName: dto.senderName,
      senderAddressStreet: dto.senderAddressStreet,
      senderAddressPostalCode: dto.senderAddressPostalCode,
      senderAddressCity: dto.senderAddressCity,
      senderPhone: dto.senderPhone ?? null,
      senderFax: dto.senderFax ?? null,
      senderEmail: dto.senderEmail ? dto.senderEmail : null,
      senderBankName: dto.senderBankName ?? null,
      senderBankIban: dto.senderBankIban ?? null,
      senderBankBic: dto.senderBankBic ?? null,
      logoMode: dto.logoMode,
      logoAlignment: dto.logoAlignment,
      logoScalePercent: dto.logoScalePercent,
      updatedAt: new Date().toISOString(),
    });

    await this.em.flush();

    return toDto(row);
  }

  /**
   * Die hier hinterlegten KI-Anbieter-Daten inklusive API-Key.
   */
  async getStoredAiSettings(): Promise<StoredAiSettings> {
    const row = await this.ensureRow();

    return {
      aiProvider: row.aiProvider,
      aiApiKey: row.aiApiKey,
      aiBaseUrl: row.aiBaseUrl,
      aiModel: row.aiModel,
    };
  }

  /**
   * KI-Einstellungen für die Oberfläche, ohne den API-Key.
   */
  async getAiSettings(): Promise<AiSettingsDto> {
    return toAiDto(await this.getStoredAiSettings());
  }

  /**
   * Aktualisiert die KI-Einstellungen. Ein fehlendes `aiApiKey` lässt den
   * gespeicherten API-Key unverändert, ein leerer String löscht ihn.
   *
   * Beim Wechsel des Anbieters wird ein noch gespeicherter API-Key
   * verworfen: er gehört zum vorherigen Anbieter und wäre beim neuen
   * bestenfalls wertlos.
   */
  async updateAiSettings(dto: AiSettingsUpdateDto): Promise<AiSettingsDto> {
    const row = await this.ensureRow();
    const providerChanged = dto.aiProvider !== row.aiProvider;

    let apiKey = row.aiApiKey;
    if (dto.aiApiKey !== undefined) {
      apiKey = dto.aiApiKey.trim() || null;
    } else if (providerChanged) {
      apiKey = null;
    }

    this.em.assign(row, {
      aiProvider: dto.aiProvider,
      aiApiKey: apiKey,
      aiBaseUrl: dto.aiBaseUrl?.trim() || null,
      aiModel: dto.aiModel?.trim() || null,
      updatedAt: new Date().toISOString(),
    });

    await this.em.flush();

    return this.getAiSettings();
  }

  /**
   * Stand der DWD-Abruf-Entscheidung (null = noch nicht entschieden).
   */
  async getClimateFactorsSettings(): Promise<ClimateFactorsSettingsDto> {
    const row = await this.ensureRow();
    return { autoFetch: row.climateFactorsAutoFetch };
  }

  /**
   * Speichert die Entscheidung, ob Klimafaktoren automatisch von
   * opendata.dwd.de geladen werden dürfen.
   */
  async updateClimateFactorsSettings(
    dto: ClimateFactorsSettingsUpdateDto,
  ): Promise<ClimateFactorsSettingsDto> {
    const row = await this.ensureRow();

    this.em.assign(row, {
      climateFactorsAutoFetch: dto.autoFetch,
      updatedAt: new Date().toISOString(),
    });

    await this.em.flush();

    return { autoFetch: row.climateFactorsAutoFetch };
  }

  /**
   * Stand der Einwilligungen für Internetzugriffe (null = noch nicht
   * entschieden).
   */
  async getInternetSettings(): Promise<InternetSettingsDto> {
    const row = await this.ensureRow();
    return {
      climateFactorsAutoFetch: row.climateFactorsAutoFetch,
      updateCheckEnabled: row.updateCheckEnabled,
      telemetryEnabled: row.telemetryEnabled,
      installationId: row.installationId,
    };
  }

  /**
   * Setzt nur die übergebenen Einwilligungen, die anderen bleiben wie sie
   * sind.
   */
  async updateInternetSettings(
    dto: InternetSettingsUpdateDto,
  ): Promise<InternetSettingsDto> {
    const row = await this.ensureRow();
    const consentGiven =
      dto.telemetryEnabled === true && row.telemetryEnabled !== true;

    this.em.assign(row, {
      ...(dto.climateFactorsAutoFetch !== undefined && {
        climateFactorsAutoFetch: dto.climateFactorsAutoFetch,
      }),
      ...(dto.updateCheckEnabled !== undefined && {
        updateCheckEnabled: dto.updateCheckEnabled,
      }),
      ...(dto.telemetryEnabled !== undefined && {
        telemetryEnabled: dto.telemetryEnabled,
      }),
      updatedAt: new Date().toISOString(),
    });

    await this.em.flush();

    if (consentGiven) {
      this.telemetry.sendAfterConsent();
    }

    return this.getInternetSettings();
  }

  /**
   * Validiert/härtet das Logo, schreibt es unter einem neuen Key in den
   * Storage und räumt die vorherige Datei nach dem DB-Commit ab.
   */
  async uploadLogo(file: LogoUploadInput): Promise<SenderSettingsDto> {
    const data = await this.prepareLogoData(file);

    const row = await this.ensureRow();
    const extension = MIME_TO_EXT[file.mimetype] ?? "bin";
    const newKey = storageKeyForLogo(extension);

    const previousKey = row.logoStorageKey;
    await this.storage.write(newKey, data);

    this.em.assign(row, {
      logoStorageKey: newKey,
      logoMimeType: file.mimetype,
      updatedAt: new Date().toISOString(),
    });

    try {
      await this.em.flush();
    } catch (error) {
      // DB-Update fehlgeschlagen -> neue Datei wieder entfernen, damit die DB
      // weiter auf die alte zeigt.
      await this.storage.delete(newKey).catch((err) => {
        this.logger.warn(
          `Logo-Rollback fehlgeschlagen, Datei ${newKey} bleibt verwaist`,
          err instanceof Error ? err.stack : String(err),
        );
      });
      throw error;
    }

    // Alte Datei erst nach erfolgreichem Commit löschen
    if (previousKey) {
      await this.storage.delete(previousKey).catch((err) => {
        this.logger.warn(
          `Altes Logo ${previousKey} konnte nicht gelöscht werden`,
          err instanceof Error ? err.stack : String(err),
        );
      });
    }

    return toDto(row);
  }

  /**
   * Rendert die noch nicht gespeicherte Datei als PDF-Vorschau.
   */
  async renderLogoPreview(file: LogoUploadInput): Promise<Buffer> {
    const data = await this.prepareLogoData(file);
    return renderLogoPdf(data, file.mimetype);
  }

  /**
   * Rendert das aktuell gespeicherte Logo als PDF-Vorschau (`null`, wenn keins).
   */
  async renderStoredLogoPreview(): Promise<Buffer | null> {
    const logo = await this.loadLogo();
    if (!logo) {
      return null;
    }
    return renderLogoPdf(logo.data, logo.mimeType);
  }

  /**
   * Validiert Typ/Größe und härtet SVGs; liefert die zu speichernden Bytes.
   */
  private async prepareLogoData(file: LogoUploadInput): Promise<Buffer> {
    assertUploadAllowed(
      file.mimetype,
      file.size,
      ALLOWED_LOGO_MIME_TYPES,
      MAX_LOGO_BYTES,
    );

    // SVGs werden aus erlaubten Elementen neu aufgebaut und auf RGB-Farben
    // normalisiert; Live-Text und alles, was react-pdf nicht zeichnen kann,
    // wird abgelehnt. Sonst crasht die PDF-Erzeugung oder das Logo fehlt.
    return file.mimetype === "image/svg+xml"
      ? Buffer.from(await this.sanitizeSvg(file.buffer))
      : file.buffer;
  }

  /**
   * Härtet ein SVG und übersetzt Sanitize-Fehler in lokalisierte
   * `BadRequestException`s.
   */
  private async sanitizeSvg(buffer: Buffer): Promise<string> {
    try {
      return await sanitizeSvgInWorker(buffer.toString("utf8"));
    } catch (error) {
      if (error instanceof SvgSanitizeError) {
        throw new BadRequestException(
          getI18n().t(SVG_ERROR_KEYS[error.reason]),
          { cause: error },
        );
      }

      throw error;
    }
  }

  /**
   * Entfernt das Logo aus Storage und Settings (best-effort beim Storage).
   */
  async deleteLogo(): Promise<SenderSettingsDto> {
    const row = await this.ensureRow();
    const previousKey = row.logoStorageKey;

    this.em.assign(row, {
      logoStorageKey: null,
      logoMimeType: null,
      updatedAt: new Date().toISOString(),
    });

    await this.em.flush();

    // Datei erst nach erfolgreichem Commit löschen; schlägt der
    // Flush fehl, bleibt die DB-Referenz samt Datei intakt.
    if (previousKey) {
      await this.storage.delete(previousKey).catch((err) => {
        this.logger.warn(
          `Logo ${previousKey} konnte nicht gelöscht werden`,
          err instanceof Error ? err.stack : String(err),
        );
      });
    }

    return toDto(row);
  }

  /**
   * Lädt die gespeicherten Logo-Bytes samt MIME-Typ (`null`, wenn keins
   * hinterlegt ist).
   */
  async loadLogo(): Promise<{ data: Buffer; mimeType: string } | null> {
    const row = await this.ensureRow();
    if (!row.logoStorageKey || !row.logoMimeType) {
      return null;
    }

    const data = await this.storage.read(row.logoStorageKey);

    return { data, mimeType: row.logoMimeType };
  }

  /**
   * Holt die einzige AppSettings-Zeile oder legt sie mit leeren Defaults an
   * (Singleton via `APP_SETTINGS_ID`).
   */
  private async ensureRow(): Promise<AppSettings> {
    const existing = await this.em.findOne(AppSettingsSchema, {
      id: APP_SETTINGS_ID,
    });
    if (existing) {
      return existing;
    }

    const created = this.em.create(AppSettingsSchema, {
      id: APP_SETTINGS_ID,
      senderName: "",
      senderAddressStreet: "",
      senderAddressPostalCode: "",
      senderAddressCity: "",
      logoMode: "app",
      lastAppVersion: currentAppVersion,
    });

    this.em.persist(created);
    await this.em.flush();

    return created;
  }
}
