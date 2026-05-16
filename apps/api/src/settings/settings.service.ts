import {
  APP_SETTINGS_ID,
  type AppSettings,
  AppSettingsSchema,
} from "@einfachvermieter/db";
import type {
  SenderSettingsDto,
  SenderSettingsUpdateDto,
} from "@einfachvermieter/shared";
import { EntityManager } from "@mikro-orm/core";
import { BadRequestException, Injectable } from "@nestjs/common";
import {
  renderLogoDocument,
  sanitizeSvgInWorker,
} from "../common/pdf-worker.js";
import { assertUploadAllowed } from "../common/upload-guard.js";
import { getI18n } from "../i18n/i18n.registry.js";
import { StorageService } from "../storage/storage.service.js";
import { SvgSanitizeError } from "./sanitize-svg.js";

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
 * Bildet den Storage-Key fürs Absender-Logo aus der (gesäuberten) Endung.
 */
const storageKeyForLogo = (extension: string): string => {
  const safeExt = extension.replace(/[^a-z0-9]/giu, "").toLowerCase();
  const suffix = safeExt ? `.${safeExt}` : "";
  return `settings/sender-logo${suffix}`;
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
  useLogo: row.useLogo,
  hasLogo: row.logoStorageKey !== null,
  logoMimeType: row.logoMimeType,
});

@Injectable()
export class SettingsService {
  constructor(
    private readonly em: EntityManager,
    private readonly storage: StorageService,
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
      useLogo: dto.useLogo,
      updatedAt: new Date().toISOString(),
    });

    await this.em.flush();

    return toDto(row);
  }

  /**
   * Validiert/härtet das Logo, schreibt es in den Storage und ersetzt eine
   * ggf. vorhandene Datei mit abweichendem Key.
   */
  async uploadLogo(file: LogoUploadInput): Promise<SenderSettingsDto> {
    const data = await this.prepareLogoData(file);

    const row = await this.ensureRow();
    const extension = MIME_TO_EXT[file.mimetype] ?? "bin";
    const newKey = storageKeyForLogo(extension);

    await this.storage.write(newKey, data);

    if (row.logoStorageKey && row.logoStorageKey !== newKey) {
      await this.storage.delete(row.logoStorageKey).catch(() => undefined);
    }

    this.em.assign(row, {
      logoStorageKey: newKey,
      logoMimeType: file.mimetype,
      updatedAt: new Date().toISOString(),
    });
    await this.em.flush();

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

    // SVGs werden gehärtet (Skripte/externe Refs entfernt), auf RGB-Farben
    // normalisiert und bei Live-Text abgelehnt. Sonst crasht die PDF-Erzeugung.
    return file.mimetype === "image/svg+xml"
      ? Buffer.from(await this.sanitizeSvg(file.buffer))
      : file.buffer;
  }

  /**
   * Härtet ein SVG und übersetzt Sanitize-Fehler in lokalisierte
   * `BadRequestException`s (Live-Text vs. ungültiges SVG).
   */
  private async sanitizeSvg(buffer: Buffer): Promise<string> {
    try {
      return await sanitizeSvgInWorker(buffer.toString("utf8"));
    } catch (error) {
      if (error instanceof SvgSanitizeError) {
        const messageKey =
          error.reason === "text"
            ? "errors.logoSvgText"
            : "errors.logoSvgInvalid";
        throw new BadRequestException(getI18n().t(messageKey), {
          cause: error,
        });
      }

      throw error;
    }
  }

  /**
   * Entfernt das Logo aus Storage und Settings (best-effort beim Storage).
   */
  async deleteLogo(): Promise<SenderSettingsDto> {
    const row = await this.ensureRow();
    if (row.logoStorageKey) {
      await this.storage.delete(row.logoStorageKey).catch(() => undefined);
    }

    this.em.assign(row, {
      logoStorageKey: null,
      logoMimeType: null,
      updatedAt: new Date().toISOString(),
    });

    await this.em.flush();

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
      useLogo: true,
    });

    this.em.persist(created);
    await this.em.flush();

    return created;
  }
}
