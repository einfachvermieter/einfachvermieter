import { EntitySchema, type Opt } from "@mikro-orm/core";
import { currentTimestamp } from "./_defaults.js";

export const APP_SETTINGS_ID = "default";

/**
 * Globale Anwendungs-Einstellungen als Singleton (genau eine Zeile mit
 * id = "default"): Absender-Daten für ausgehende Schreiben und die
 * Anbindung des KI-Anbieters für das Auslesen von Rechnungen.
 */
export type AppSettings = {
  id: string;
  senderName: string;
  senderAddressStreet: string;
  senderAddressPostalCode: string;
  senderAddressCity: string;
  senderPhone: string | null;
  senderFax: string | null;
  senderEmail: string | null;
  senderBankName: string | null;
  senderBankIban: string | null;
  senderBankBic: string | null;
  logoMode: Opt<string>;
  logoAlignment: Opt<string>;
  logoScalePercent: Opt<number>;
  logoStorageKey: string | null;
  logoMimeType: string | null;
  aiProvider: string | null;
  aiApiKey: string | null;
  aiBaseUrl: string | null;
  aiModel: string | null;
  climateFactorsAutoFetch: boolean | null;
  updateCheckEnabled: boolean | null;
  telemetryEnabled: boolean | null;
  installationId: string | null;
  telemetryLastSentAt: string | null;
  lastAppVersion: string | null;
  createdAt: Opt<string>;
  updatedAt: Opt<string>;
};

export const AppSettingsSchema = new EntitySchema<AppSettings>({
  name: "AppSettings",
  tableName: "app_settings",
  properties: {
    id: { type: "string", primary: true, default: APP_SETTINGS_ID },
    senderName: { type: "string", fieldName: "sender_name", default: "" },
    senderAddressStreet: {
      type: "string",
      fieldName: "sender_address_street",
      default: "",
    },
    senderAddressPostalCode: {
      type: "string",
      fieldName: "sender_address_postal_code",
      default: "",
    },
    senderAddressCity: {
      type: "string",
      fieldName: "sender_address_city",
      default: "",
    },
    senderPhone: { type: "string", fieldName: "sender_phone", nullable: true },
    senderFax: { type: "string", fieldName: "sender_fax", nullable: true },
    senderEmail: { type: "string", fieldName: "sender_email", nullable: true },
    senderBankName: {
      type: "string",
      fieldName: "sender_bank_name",
      nullable: true,
    },
    senderBankIban: {
      type: "string",
      fieldName: "sender_bank_iban",
      nullable: true,
    },
    senderBankBic: {
      type: "string",
      fieldName: "sender_bank_bic",
      nullable: true,
    },
    logoMode: { type: "string", fieldName: "logo_mode", default: "app" },
    logoAlignment: {
      type: "string",
      fieldName: "logo_alignment",
      default: "center",
    },
    logoScalePercent: {
      type: "integer",
      fieldName: "logo_scale_percent",
      default: 100,
    },
    logoStorageKey: {
      type: "text",
      fieldName: "logo_storage_key",
      nullable: true,
    },
    logoMimeType: {
      type: "string",
      fieldName: "logo_mime_type",
      nullable: true,
    },
    aiProvider: { type: "string", fieldName: "ai_provider", nullable: true },
    aiApiKey: { type: "text", fieldName: "ai_api_key", nullable: true },
    aiBaseUrl: { type: "text", fieldName: "ai_base_url", nullable: true },
    aiModel: { type: "string", fieldName: "ai_model", nullable: true },
    climateFactorsAutoFetch: {
      type: "boolean",
      fieldName: "climate_factors_auto_fetch",
      nullable: true,
    },
    updateCheckEnabled: {
      type: "boolean",
      fieldName: "update_check_enabled",
      nullable: true,
    },
    telemetryEnabled: {
      type: "boolean",
      fieldName: "telemetry_enabled",
      nullable: true,
    },
    installationId: {
      type: "string",
      fieldName: "installation_id",
      nullable: true,
    },
    telemetryLastSentAt: {
      type: "string",
      fieldName: "telemetry_last_sent_at",
      nullable: true,
    },
    lastAppVersion: {
      type: "string",
      fieldName: "last_app_version",
      nullable: true,
    },
    createdAt: {
      type: "string",
      fieldName: "created_at",
      defaultRaw: currentTimestamp,
    },
    updatedAt: {
      type: "string",
      fieldName: "updated_at",
      defaultRaw: currentTimestamp,
    },
  },
});
