import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { getI18n } from "../i18n/i18n.registry.js";
import { SettingsService } from "../settings/settings.service.js";
import type { AiClient } from "./ai-client.js";
import { type AiRuntimeConfig, resolveAiRuntimeConfig } from "./ai-config.js";
import { AnthropicClient } from "./anthropic-client.js";
import { OpenAiCompatibleClient } from "./openai-compatible-client.js";

/**
 * Baut zur aufgelösten Anbindung den passenden Client.
 */
const createClient = (config: AiRuntimeConfig): AiClient =>
  config.provider === "anthropic"
    ? new AnthropicClient({
        // `resolveAiRuntimeConfig` stellt sicher, dass Anbieter mit
        // API-Key-Pflicht einen haben.
        apiKey: config.apiKey ?? "",
        baseUrl: config.baseUrl || null,
        model: config.model,
      })
    : new OpenAiCompatibleClient({
        provider: config.provider,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
      });

/**
 * Liefert den aktuell eingestellten KI-Client.
 */
@Injectable()
export class AiClientFactory {
  constructor(private readonly settings: SettingsService) {}

  /**
   * Die aktive Anbindung oder `null`, wenn die KI-Extraktion nicht
   * eingerichtet ist.
   */
  async resolveConfig(): Promise<AiRuntimeConfig | null> {
    return resolveAiRuntimeConfig(
      await this.settings.getStoredAiSettings(),
      process.env,
    );
  }

  /**
   * Client samt Anbindung, oder ein sprechender Fehler, wenn nichts
   * eingerichtet ist.
   */
  async require(): Promise<{ client: AiClient; config: AiRuntimeConfig }> {
    const config = await this.resolveConfig();
    if (!config) {
      throw new ServiceUnavailableException(
        getI18n().t("errors.ai.notConfigured"),
      );
    }

    return { client: createClient(config), config };
  }
}
