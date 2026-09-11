import { APP_SETTINGS_ID, AppSettingsSchema } from "@einfachvermieter/db";
import {
  type AppPlatform,
  compareVersions,
  isNewerVersion,
  isPrerelease,
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
type UpdateChannel = "stable" | "beta";

/**
 * Aufbau der Versionsdatei: je Build-Schlüssel ein Kanal-Paar, je Kanal ein
 * Eintrag.
 */
type Feed = Partial<Record<AppPlatform, unknown>>;

/**
 * Nur `https:`-Adressen: Der Wert landet als Link in der Oberfläche und in
 * der Desktop-App in `shell.openExternal`.
 */
const isHttpsUrl = (value: unknown): value is string =>
  typeof value === "string" && URL.parse(value)?.protocol === "https:";

const toFeedEntry = (candidate: unknown): FeedEntry | null => {
  if (typeof candidate !== "object" || candidate === null) {
    return null;
  }
  const { version, downloadUrl, releaseNotesUrl, availableFrom } =
    candidate as Partial<FeedEntry>;
  return typeof version === "string" && isHttpsUrl(downloadUrl)
    ? {
        version,
        downloadUrl,
        releaseNotesUrl: isHttpsUrl(releaseNotesUrl) ? releaseNotesUrl : null,
        availableFrom: typeof availableFrom === "string" ? availableFrom : null,
      }
    : null;
};

/**
 * Eintrag für diesen Kanal. Eine stabile Installation sieht nur den stabilen
 * Zweig. Eine Vorabversion nimmt den höheren von beiden, damit sie nicht auf
 * einer alten Beta hängen bleibt, wenn der Kanal ruht oder dieser
 * Veröffentlichungsweg gar keine Betas anbietet.
 */
export const pickEntry = (
  byChannel: unknown,
  channel: UpdateChannel,
): FeedEntry | null => {
  if (typeof byChannel !== "object" || byChannel === null) {
    return null;
  }

  const { stable, beta } = byChannel as Record<UpdateChannel, unknown>;

  return (
    (channel === "beta" ? [stable, beta] : [stable])
      .map(toFeedEntry)
      .filter((entry) => entry !== null)
      .sort((a, b) => compareVersions(b.version, a.version))[0] ?? null
  );
};

@Injectable()
export class UpdatesService {
  private readonly logger = new Logger(UpdatesService.name);
  private readonly currentVersion = currentAppVersion;
  private readonly platform = appPlatform;
  private readonly channel: UpdateChannel = isPrerelease(currentAppVersion)
    ? "beta"
    : "stable";
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
        entry = pickEntry(feed[this.platform], this.channel);
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
