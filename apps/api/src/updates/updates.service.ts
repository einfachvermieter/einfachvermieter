import {
  APP_SETTINGS_ID,
  AppSettingsSchema,
  detectDialect,
} from "@einfachvermieter/db";
import {
  type AppPlatform,
  compareVersions,
  isNewerVersion,
  isPrerelease,
  type UpdateMessage,
  type UpdateMessageConditions,
  type UpdateStatus,
  updateMessageFeedSchema,
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
const RETRY_AFTER_FAILURE_MS = 60 * 60 * 1000;
const MAX_FEED_BYTES = 32 * 1024;
const MAX_MESSAGES = 3;

type FeedEntry = {
  version: string;
  downloadUrl: string;
  releaseNotesUrl: string | null;
  availableFrom: string | null;
};
type UpdateChannel = "stable" | "beta";

/**
 * Aufbau der Versionsdatei: je Build-Schlüssel ein Kanal-Paar, je Kanal ein
 * Eintrag. Daneben `messages` mit den Mitteilungen.
 */
type Feed = Partial<Record<AppPlatform, unknown>> & { messages?: unknown };

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

/**
 * Werte der Installation, gegen die die Bedingungen einer Mitteilung
 * geprüft werden
 */
export type MessageContext = {
  version: string;
  platform: AppPlatform;
  os: string;
  dbDialect: string;
};

const matchesConditions = (
  conditions: UpdateMessageConditions | undefined,
  context: MessageContext,
): boolean =>
  !conditions ||
  ((conditions.minVersion === undefined ||
    compareVersions(context.version, conditions.minVersion) >= 0) &&
    (conditions.belowVersion === undefined ||
      compareVersions(context.version, conditions.belowVersion) < 0) &&
    (conditions.platforms?.includes(context.platform) ?? true) &&
    (conditions.os?.includes(context.os) ?? true) &&
    (conditions.dbDialects?.includes(context.dbDialect) ?? true));

/**
 * Mitteilungen aus der Versionsdatei, die für diese Installation gelten.
 */
export const pickMessages = (
  candidates: unknown,
  context: MessageContext,
): UpdateMessage[] =>
  (Array.isArray(candidates) ? candidates : [])
    .map((candidate) => updateMessageFeedSchema.safeParse(candidate).data)
    .filter((message) => message !== undefined)
    .filter((message) => matchesConditions(message.conditions, context))
    .slice(0, MAX_MESSAGES)
    .map(({ conditions: _conditions, ...message }) => message);

/**
 * Liest den Body bis zur Obergrenze und bricht darüber ab. Die Feldlängen
 * im Schema greifen erst nach dem Parsen und ersetzen diese Grenze nicht.
 */
const readLimitedText = async (response: Response): Promise<string> => {
  const reader = response.body?.getReader();
  if (!reader) {
    return "";
  }

  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      return Buffer.concat(chunks).toString("utf8");
    }

    size += value.byteLength;
    if (size > MAX_FEED_BYTES) {
      await reader.cancel();
      throw new Error(`mehr als ${MAX_FEED_BYTES} Bytes`);
    }
    chunks.push(value);
  }
};

type FeedState = { entry: FeedEntry | null; messages: UpdateMessage[] };

@Injectable()
export class UpdatesService {
  private readonly logger = new Logger(UpdatesService.name);
  private readonly currentVersion = currentAppVersion;
  private readonly platform = appPlatform;
  private readonly channel: UpdateChannel = isPrerelease(currentAppVersion)
    ? "beta"
    : "stable";
  private readonly feedUrl = process.env.UPDATE_FEED_URL || DEFAULT_FEED_URL;

  // In-Memory-Cache: ein Abruf pro Tag reicht. Nach einem Fehlschlag bleibt
  // der letzte gute Stand stehen, der nächste Versuch folgt nach einer
  // Stunde, damit ein nicht erreichbarer Server nicht jede Anfrage bremst.
  private cached: FeedState | null = null;
  private succeededAt: number | null = null;
  private failedAt: number | null = null;
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
      messages: [],
    };

    // Ohne Einwilligung keine Anfrage und auch nichts aus dem Cache
    if (enabled !== true) {
      return base;
    }

    const state = await this.feedState();
    const entry = state?.entry;
    const withMessages = { ...base, messages: state?.messages ?? [] };
    if (
      !entry ||
      !isNewerVersion(entry.version, this.currentVersion) ||
      !this.isAvailable(entry)
    ) {
      return withMessages;
    }

    return {
      ...withMessages,
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

  private async feedState(): Promise<FeedState | null> {
    const now = Date.now();
    const fresh =
      this.cached !== null &&
      this.succeededAt !== null &&
      now - this.succeededAt < CACHE_TTL_MS;
    const recentlyFailed =
      this.failedAt !== null && now - this.failedAt < RETRY_AFTER_FAILURE_MS;

    if (fresh || recentlyFailed) {
      return this.cached;
    }

    try {
      this.cached = await this.fetchFeed();
      this.succeededAt = Date.now();
      this.failedAt = null;
    } catch (error) {
      this.failedAt = Date.now();
      this.logger.warn(
        `Versionsdatei nicht abrufbar: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return this.cached;
  }

  /**
   * Holt die Versionsdatei. Als Erfolg zählen nur 200 mit JSON und 304 mit
   * einem Stand im Cache, alles andere wirft.
   */
  private async fetchFeed(): Promise<FeedState> {
    const response = await fetch(this.feedUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "error",
      headers: this.etag ? { "If-None-Match": this.etag } : undefined,
    });

    if (response.status === 304) {
      if (this.cached) {
        return this.cached;
      }
      // Ohne Stand nützt die Kurzantwort nichts: nächstes Mal ganz holen
      this.etag = null;
      throw new Error("HTTP 304 ohne Stand im Cache");
    }

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (
      contentType.split(";")[0]?.trim().toLowerCase() !== "application/json"
    ) {
      throw new Error(`content-type "${contentType}"`);
    }

    const feed = JSON.parse(await readLimitedText(response)) as Feed | null;
    this.etag = response.headers.get("etag");

    return {
      entry: pickEntry(feed?.[this.platform], this.channel),
      messages: pickMessages(feed?.messages, {
        version: this.currentVersion,
        platform: this.platform,
        os: process.platform,
        dbDialect: detectDialect(),
      }),
    };
  }
}
