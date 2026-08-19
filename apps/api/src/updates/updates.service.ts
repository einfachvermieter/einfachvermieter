import { APP_SETTINGS_ID, AppSettingsSchema } from "@einfachvermieter/db";
import {
  type AppPlatform,
  isNewerVersion,
  type UpdateStatus,
} from "@einfachvermieter/shared";
import { EntityManager } from "@mikro-orm/core";
import { Injectable, Logger } from "@nestjs/common";
import { appPlatform, currentAppVersion } from "./app-version.js";

/**
 * Versionsdatei auf dem Projektserver
 */
const DEFAULT_FEED_URL = "https://api.einfachvermieter.de/version.json";

const FETCH_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type FeedEntry = {
  version: string;
  downloadUrl: string;
  releaseNotesUrl: string | null;
  availableFrom: string | null;
};
type Feed = Partial<Record<AppPlatform, unknown>>;

const toFeedEntry = (candidate: unknown): FeedEntry | null => {
  if (typeof candidate !== "object" || candidate === null) {
    return null;
  }
  const { version, downloadUrl, releaseNotesUrl, availableFrom } =
    candidate as Partial<FeedEntry>;
  return typeof version === "string" && typeof downloadUrl === "string"
    ? {
        version,
        downloadUrl,
        releaseNotesUrl:
          typeof releaseNotesUrl === "string" ? releaseNotesUrl : null,
        availableFrom: typeof availableFrom === "string" ? availableFrom : null,
      }
    : null;
};

@Injectable()
export class UpdatesService {
  private readonly logger = new Logger(UpdatesService.name);
  private readonly currentVersion = currentAppVersion;
  private readonly platform = appPlatform;
  private readonly feedUrl = process.env.UPDATE_FEED_URL || DEFAULT_FEED_URL;

  // In-Memory-Cache: ein Abruf pro Tag reicht. Fehlschläge werden ebenfalls
  // gemerkt, damit ein nicht erreichbarer Server nicht jede Anfrage bremst.
  private cached: { entry: FeedEntry | null; fetchedAt: number } | null = null;
  private etag: string | null = null;

  constructor(private readonly em: EntityManager) {}

  async getStatus(): Promise<UpdateStatus> {
    const settings = await this.em.findOne(AppSettingsSchema, {
      id: APP_SETTINGS_ID,
    });
    const enabled = settings?.updateCheckEnabled ?? null;
    const base: UpdateStatus = {
      enabled,
      platform: this.platform,
      currentVersion: this.currentVersion,
      latestVersion: null,
      downloadUrl: null,
      releaseNotesUrl: null,
      availableFrom: null,
    };

    if (enabled !== true) {
      return base;
    }

    const entry = await this.latestEntry();
    if (
      !entry ||
      !isNewerVersion(entry.version, this.currentVersion) ||
      !this.isAvailable(entry)
    ) {
      return base;
    }

    return {
      ...base,
      latestVersion: entry.version,
      downloadUrl: entry.downloadUrl,
      releaseNotesUrl: entry.releaseNotesUrl,
      availableFrom: entry.availableFrom,
    };
  }

  /**
   * Ein Eintrag mit `availableFrom` in der Zukunft wird noch nicht gemeldet
   * (z.B. Windows-Store-Freigabe). Unlesbarer Zeitpunkt zählt als sofort.
   */
  private isAvailable(entry: FeedEntry): boolean {
    if (!entry.availableFrom) {
      return true;
    }

    const availableFrom = Date.parse(entry.availableFrom);

    if (Number.isNaN(availableFrom)) {
      this.logger.warn(
        `Versionsdatei: availableFrom "${entry.availableFrom}" nicht lesbar`,
      );
      return true;
    }

    return availableFrom <= Date.now();
  }

  private async latestEntry(): Promise<FeedEntry | null> {
    if (this.cached && Date.now() - this.cached.fetchedAt < CACHE_TTL_MS) {
      return this.cached.entry;
    }

    let entry: FeedEntry | null = null;
    try {
      const response = await fetch(this.feedUrl, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: this.etag ? { "If-None-Match": this.etag } : undefined,
      });

      if (response.status === 304) {
        entry = this.cached?.entry ?? null;
      } else if (response.ok) {
        const feed = (await response.json()) as Feed;
        entry = toFeedEntry(feed[this.platform]);
        this.etag = response.headers.get("etag");
      } else {
        this.logger.warn(
          `Versionsdatei nicht abrufbar: HTTP ${response.status}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Versionsdatei nicht abrufbar: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    this.cached = { entry, fetchedAt: Date.now() };
    return entry;
  }
}
