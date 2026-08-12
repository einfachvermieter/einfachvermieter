import { EntitySchema, type Opt } from "@mikro-orm/core";

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
  useLogo: boolean;
  logoStorageKey: string | null;
  logoMimeType: string | null;
  aiProvider: string | null;
  aiApiKey: string | null;
  aiBaseUrl: string | null;
  aiModel: string | null;
  climateFactorsAutoFetch: boolean | null;
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
    useLogo: { type: "boolean", fieldName: "use_logo", default: true },
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
    createdAt: {
      type: "string",
      fieldName: "created_at",
      defaultRaw: "current_timestamp",
    },
    updatedAt: {
      type: "string",
      fieldName: "updated_at",
      defaultRaw: "current_timestamp",
    },
  },
});
