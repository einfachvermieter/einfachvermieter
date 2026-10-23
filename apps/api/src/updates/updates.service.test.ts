import type { EntityManager } from "@mikro-orm/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { currentAppVersion } from "./app-version.js";
import {
  type MessageContext,
  pickEntry,
  pickMessages,
  UpdatesService,
} from "./updates.service.js";

const entry = (version: string) => ({
  version,
  downloadUrl: `https://example.test/${version}`,
});

const feed = {
  stable: entry("2026.1.0"),
  beta: entry("2026.2.0-beta.1"),
};

describe("pickEntry", () => {
  it("bietet stabilen Installationen nur den stabilen Zweig an", () => {
    expect(pickEntry(feed, "stable")?.version).toBe("2026.1.0");
  });

  it("bietet Vorabversionen die neuere Beta an", () => {
    expect(pickEntry(feed, "beta")?.version).toBe("2026.2.0-beta.1");
  });

  it("holt Vorabversionen auf den stabilen Zweig zurück, wenn dieser weiter ist", () => {
    const feedWithOldBeta = {
      stable: entry("2026.2.0"),
      beta: entry("2026.2.0-beta.1"),
    };
    expect(pickEntry(feedWithOldBeta, "beta")?.version).toBe("2026.2.0");
  });

  it("liefert ohne Beta-Zweig den stabilen Eintrag und ohne Einträge null", () => {
    expect(pickEntry({ stable: entry("2026.1.0") }, "beta")?.version).toBe(
      "2026.1.0",
    );
    expect(pickEntry({ beta: entry("2026.2.0-beta.1") }, "stable")).toBeNull();
    expect(pickEntry(undefined, "stable")).toBeNull();
  });

  it("verwirft Einträge, deren Download-Adresse nicht https ist", () => {
    for (const downloadUrl of [
      "javascript:alert(1)",
      "http://example.test/2026.1.0",
      "file:///etc/passwd",
      "keine Adresse",
    ]) {
      expect(
        pickEntry({ stable: { version: "2026.1.0", downloadUrl } }, "stable"),
      ).toBeNull();
    }
  });

  it("lässt Release-Notes ohne https weg, behält aber den Eintrag", () => {
    const withUnsafeNotes = {
      stable: { ...entry("2026.1.0"), releaseNotesUrl: "javascript:alert(1)" },
    };
    const picked = pickEntry(withUnsafeNotes, "stable");
    expect(picked?.version).toBe("2026.1.0");
    expect(picked?.releaseNotesUrl).toBeNull();
  });
});

const context: MessageContext = {
  version: "2026.1.2",
  platform: "server",
  os: "linux",
  dbDialect: "libsql",
};

const message = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: "Sicherheitsupdate",
  body: "Erster Absatz.\n\nZweiter Absatz.",
  display: "once",
  ...extra,
});

const pickedIds = (candidates: unknown, forContext = context) =>
  pickMessages(candidates, forContext).map((picked) => picked.id);

describe("pickMessages", () => {
  it("zeigt eine Mitteilung ohne Bedingung allen und liefert sie ohne Bedingungen aus", () => {
    expect(pickMessages([message("a")], context)).toEqual([
      { ...message("a"), closeLabel: null, link: null },
    ]);
  });

  it("prüft jede Bedingung für sich", () => {
    const cases: [Record<string, unknown>, boolean][] = [
      [{ minVersion: "2026.1.2" }, true],
      [{ minVersion: "2026.1.3" }, false],
      [{ belowVersion: "2026.1.3" }, true],
      [{ belowVersion: "2026.1.2" }, false],
      [{ platforms: ["win-store", "server"] }, true],
      [{ platforms: ["win-store"] }, false],
      [{ os: ["linux"] }, true],
      [{ os: ["win32"] }, false],
      [{ dbDialects: ["libsql"] }, true],
      [{ dbDialects: ["mariadb"] }, false],
    ];
    for (const [conditions, shown] of cases) {
      expect(pickedIds([message("a", { conditions })])).toEqual(
        shown ? ["a"] : [],
      );
    }
  });

  it("verlangt bei mehreren Bedingungen alle", () => {
    const range = { minVersion: "2026.1.0", belowVersion: "2026.1.3" };
    expect(pickedIds([message("a", { conditions: range })])).toEqual(["a"]);
    expect(
      pickedIds([
        message("a", { conditions: { ...range, os: ["win32"] } }),
        message("b", { conditions: { ...range, os: ["linux"] } }),
      ]),
    ).toEqual(["b"]);
  });

  it("verwirft unbekannte Bedingungen, leere Listen und unlesbare Versionen", () => {
    expect(
      pickedIds([
        message("a", { conditions: { region: ["de"] } }),
        message("b", { conditions: { platforms: [] } }),
        message("c", { conditions: { belowVersion: "bald" } }),
        message("d"),
      ]),
    ).toEqual(["d"]);
  });

  it("lässt ungültige Einträge einzeln weg", () => {
    expect(
      pickedIds([
        message("a", { display: "always" }),
        message("b", { title: "x".repeat(81) }),
        { id: "c" },
        "kein Objekt",
        message("d"),
      ]),
    ).toEqual(["d"]);
  });

  it("lässt nur den Link weg, wenn er nicht auf die Projektseite führt", () => {
    const withLink = (url: string) =>
      pickMessages(
        [message("a", { link: { label: "Mehr erfahren", url } })],
        context,
      )[0];

    for (const url of [
      "http://einfachvermieter.de/hinweis",
      "javascript:alert(1)",
      "https://example.com/einfachvermieter.de",
      "https://einfachvermieter.de.example.com/",
      "https://xeinfachvermieter.de/",
      "https://einfachvermieter.de@example.com/",
    ]) {
      expect(withLink(url)).toMatchObject({ id: "a", link: null });
    }

    for (const url of [
      "https://einfachvermieter.de/hinweis",
      "https://www.einfachvermieter.de/hinweis",
    ]) {
      expect(withLink(url)?.link?.url).toBe(url);
    }
  });

  it("kappt nach dem Filtern auf drei und behält die Reihenfolge", () => {
    expect(
      pickedIds([
        message("a"),
        message("b", { conditions: { os: ["win32"] } }),
        message("c"),
        message("d"),
        message("e"),
      ]),
    ).toEqual(["a", "c", "d"]);
  });

  it("liefert ohne Liste keine Mitteilungen", () => {
    expect(pickMessages(undefined, context)).toEqual([]);
    expect(pickMessages({ id: "a" }, context)).toEqual([]);
  });
});

const HOUR_MS = 60 * 60 * 1000;

const serviceWith = (updateCheckEnabled: boolean | null = true) => {
  const settings = { updateCheckEnabled };
  const em = { findOne: async () => settings } as unknown as EntityManager;
  return { service: new UpdatesService(em), settings };
};

const feedBody = (extra: Record<string, unknown> = {}) => ({
  server: {
    stable: { version: "9999.1.0", downloadUrl: "https://example.test/x" },
    beta: { version: "9999.1.0", downloadUrl: "https://example.test/x" },
  },
  messages: [message("a")],
  ...extra,
});

const jsonResponse = (body: unknown, headers: Record<string, string> = {}) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });

describe("UpdatesService", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("liefert Version und Mitteilungen aus einem Abruf", async () => {
    fetchMock.mockResolvedValue(jsonResponse(feedBody()));
    const status = await serviceWith().service.getStatus();

    expect(status.latestVersion).toBe("9999.1.0");
    expect(status.messages.map((shown) => shown.id)).toEqual(["a"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ redirect: "error" });
  });

  it("prüft Bedingungen gegen die installierte Version", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        feedBody({
          messages: [
            message("alt", { conditions: { belowVersion: currentAppVersion } }),
            message("neu", { conditions: { minVersion: currentAppVersion } }),
          ],
        }),
      ),
    );
    const status = await serviceWith().service.getStatus();
    expect(status.messages.map((shown) => shown.id)).toEqual(["neu"]);
  });

  it("lässt den Versionshinweis bei fehlenden oder kaputten Mitteilungen stehen", async () => {
    for (const messages of [undefined, "kaputt", { id: "a" }]) {
      fetchMock.mockResolvedValue(jsonResponse(feedBody({ messages })));
      const status = await serviceWith().service.getStatus();
      expect(status.latestVersion).toBe("9999.1.0");
      expect(status.messages).toEqual([]);
    }
  });

  it("fragt ohne Einwilligung nicht an und zeigt auch nichts aus dem Cache", async () => {
    for (const enabled of [false, null]) {
      const status = await serviceWith(enabled).service.getStatus();
      expect(status.messages).toEqual([]);
    }
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValue(jsonResponse(feedBody()));
    const { service, settings } = serviceWith();
    expect((await service.getStatus()).messages).toHaveLength(1);

    settings.updateCheckEnabled = false;
    const status = await service.getStatus();
    expect(status.messages).toEqual([]);
    expect(status.latestVersion).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("behält nach einem Fehlschlag den letzten Stand und versucht es nach einer Stunde wieder", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(feedBody()));
    const { service } = serviceWith();
    await service.getStatus();

    vi.advanceTimersByTime(25 * HOUR_MS);
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    const afterFailure = await service.getStatus();
    expect(afterFailure.latestVersion).toBe("9999.1.0");
    expect(afterFailure.messages).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(HOUR_MS - 1000);
    await service.getStatus();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(2000);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(feedBody({ messages: [message("b")] })),
    );
    const recovered = await service.getStatus();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(recovered.messages.map((shown) => shown.id)).toEqual(["b"]);
  });

  it("wertet zu grosse Antworten, andere Status, andere Typen und Weiterleitungen als gescheitert", async () => {
    const failures: (() => Promise<Response>)[] = [
      () =>
        Promise.resolve(
          jsonResponse(feedBody({ padding: "x".repeat(33 * 1024) })),
        ),
      () =>
        Promise.resolve(
          new Response(JSON.stringify(feedBody()), { status: 500 }),
        ),
      () =>
        Promise.resolve(
          new Response(JSON.stringify(feedBody()), {
            status: 203,
            headers: { "content-type": "application/json" },
          }),
        ),
      () =>
        Promise.resolve(
          new Response(JSON.stringify(feedBody()), {
            status: 200,
            headers: { "content-type": "text/html" },
          }),
        ),
      () => Promise.resolve(jsonResponse("kein JSON")),
      // So meldet fetch eine Weiterleitung bei `redirect: "error"`
      () => Promise.reject(new TypeError("fetch failed")),
    ];

    for (const failure of failures) {
      fetchMock.mockImplementationOnce(failure);
      const { service } = serviceWith();
      const status = await service.getStatus();
      expect(status.latestVersion).toBeNull();
      expect(status.messages).toEqual([]);

      // Als Fehlschlag gemerkt: innerhalb der Stunde kein zweiter Versuch
      const callsAfterFailure = fetchMock.mock.calls.length;
      await service.getStatus();
      expect(fetchMock).toHaveBeenCalledTimes(callsAfterFailure);
    }
  });

  it("zählt 304 mit Stand als Erfolg und fragt danach einen Tag nicht", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(feedBody(), { etag: '"v1"' }));
    const { service } = serviceWith();
    await service.getStatus();

    vi.advanceTimersByTime(25 * HOUR_MS);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 304 }));
    const unchanged = await service.getStatus();
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toEqual({
      "If-None-Match": '"v1"',
    });
    expect(unchanged.latestVersion).toBe("9999.1.0");
    expect(unchanged.messages).toHaveLength(1);

    vi.advanceTimersByTime(23 * HOUR_MS);
    await service.getStatus();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("zählt 304 ohne Stand als Fehlschlag und holt die Datei danach ganz", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 304 }));
    const { service } = serviceWith();
    Object.assign(service, { etag: '"v1"' });

    const failed = await service.getStatus();
    expect(failed.messages).toEqual([]);
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({
      "If-None-Match": '"v1"',
    });

    vi.advanceTimersByTime(HOUR_MS + 1000);
    fetchMock.mockResolvedValueOnce(jsonResponse(feedBody()));
    const recovered = await service.getStatus();
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toBeUndefined();
    expect(recovered.messages).toHaveLength(1);
  });
});
