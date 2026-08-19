// biome-ignore-all lint/style/useNamingConvention: ENV-Variablen des API-Kindprozesses
import { randomBytes } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { createI18nSync, createTranslate } from "@einfachvermieter/i18n";
import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  type MenuItemConstructorOptions,
  session,
  shell,
  type UtilityProcess,
  utilityProcess,
} from "electron";

const t = createTranslate(createI18nSync());

// Vor jedem `getPath("userData")` und vor dem Single-Instance-Lock setzen:
// beide hängen am App-Namen (Entwicklung liefe sonst unter dem Paketnamen).
app.setName("EinfachVermieter");

/**
 * Wurzel der gebündelten Server-Ressourcen (API-Build, Web-Build, Packages).
 * Im Paket liegt sie unter `resources/app` (siehe `extraResources` in
 * electron-builder.yml), in der Entwicklung ist es der Repo-Root. Dort
 * müssen API und Web zuvor gebaut sein (`npm run build`).
 */
const resourcesRoot = app.isPackaged
  ? join(process.resourcesPath, "app")
  : join(__dirname, "../../..");

const apiEntry = join(resourcesRoot, "apps/api/dist/main.js");
const webDistPath = join(resourcesRoot, "apps/web/dist");

/**
 * Alle volatilen Daten (DB, Uploads, Abrechnungen) im User-Space.
 */
const dataDir = (): string => join(app.getPath("userData"), "data");
const dbPath = (): string => join(dataDir(), "einfachvermieter.db");

let apiProcess: UtilityProcess | null = null;
let mainWindow: BrowserWindow | null = null;
let appOrigin: string | null = null;
let quitting = false;

/**
 * Lässt das OS einen freien Loopback-Port wählen und gibt ihn wieder frei.
 */
const findFreePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();

      if (address === null || typeof address === "string") {
        probe.close();
        reject(new Error("Port-Suche fehlgeschlagen"));
        return;
      }

      probe.close(() => resolve(address.port));
    });
  });

/**
 * Kopiert die DB-Datei vor dem ersten Start einer neuen App-Version nach
 * `backups/`. Ersatz für den Volume-Snapshot, den es im Docker-Betrieb gäbe:
 * die anschließende Migration (`migrator.up()` im API-Boot) läuft damit nie
 * ohne Rückfallebene.
 */
const backupOnVersionChange = (): void => {
  const versionFile = join(app.getPath("userData"), "last-run-version");
  const lastVersion = existsSync(versionFile)
    ? readFileSync(versionFile, "utf8").trim()
    : null;
  const version = app.getVersion();

  if (lastVersion !== version && existsSync(dbPath())) {
    const backupsDir = join(dataDir(), "backups");
    mkdirSync(backupsDir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    copyFileSync(dbPath(), join(backupsDir, `${version}-${date}.db`));
  }

  writeFileSync(versionFile, version);
};

/**
 * Startet die kompilierte NestJS-API als Kindprozess (Electrons gebündeltes
 * Node). Loopback-only, Daten im User-Space, `local`-Auth-Modus. Explizites
 * `DATABASE_URL`, damit eine `.env` im Repo-Root (Entwicklung) nicht auf die
 * Dev-Datenbank zeigt.
 */
const startApi = async (): Promise<{ port: number; token: string }> => {
  const port = await findFreePort();
  const token = randomBytes(32).toString("hex");
  mkdirSync(dataDir(), { recursive: true });

  apiProcess = utilityProcess.fork(apiEntry, [], {
    serviceName: "einfachvermieter-api",
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "production",
      AUTH_MODE: "local",
      HOST: "127.0.0.1",
      PORT: String(port),
      WEB_ORIGIN: `http://127.0.0.1:${port}`,
      WEB_DIST_PATH: webDistPath,
      DATA_DIR: dataDir(),
      DATABASE_URL: dbPath(),
      LOOPBACK_TOKEN: token,
      APP_PLATFORM: process.platform === "darwin" ? "macos" : "win",
    },
  });

  apiProcess.on("exit", (code) => {
    apiProcess = null;
    if (!quitting && code !== 0) {
      dialog.showErrorBox(
        t("desktop.error.apiCrashTitle"),
        t("desktop.error.apiCrashMessage"),
      );
      app.quit();
    }
  });

  return { port, token };
};

/**
 * Wartet, bis die API auf dem Loopback-Port antwortet (max. 30 s)
 */
const waitForApi = async (port: number, token: string): Promise<void> => {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline && apiProcess !== null) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
        headers: { "x-loopback-token": token },
      });
      if (response.ok) {
        return;
      }
    } catch {
      // API bootet noch (Migrationen, ORM-Init) - weiter warten.
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error("API nicht erreichbar");
};

type WindowState = {
  x?: number;
  y?: number;
  width: number;
  height: number;
  maximized: boolean;
};

const windowStateFile = (): string =>
  join(app.getPath("userData"), "window-state.json");

const readWindowState = (): WindowState | null => {
  try {
    return JSON.parse(readFileSync(windowStateFile(), "utf8")) as WindowState;
  } catch {
    return null;
  }
};

const saveWindowState = (window: BrowserWindow): void => {
  const bounds = window.getNormalBounds();
  const state: WindowState = { ...bounds, maximized: window.isMaximized() };
  try {
    writeFileSync(windowStateFile(), JSON.stringify(state));
  } catch {
    // Fenster-Persistenz ist Komfort, kein Startblocker.
  }
};

/**
 * Deutsches App-Menü; Rollen liefern die Standard-Shortcuts (Cmd+C usw.).
 */
const buildMenu = (): Menu => {
  const macAppMenu: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: "about", label: t("desktop.menu.about") },
        { type: "separator" },
        { role: "services", label: t("desktop.menu.services") },
        { type: "separator" },
        { role: "hide", label: t("desktop.menu.hide") },
        { role: "hideOthers", label: t("desktop.menu.hideOthers") },
        { role: "unhide", label: t("desktop.menu.unhide") },
        { type: "separator" },
        { role: "quit", label: t("desktop.menu.quit") },
      ],
    },
  ];

  const fileSubmenu: MenuItemConstructorOptions[] = [
    {
      label: t("desktop.menu.openDataFolder"),
      click: () => {
        shell.showItemInFolder(dbPath());
      },
    },
  ];
  if (process.platform !== "darwin") {
    fileSubmenu.push(
      { type: "separator" },
      {
        role: "quit",
        label: t("desktop.menu.quit"),
      },
    );
  }

  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === "darwin" ? macAppMenu : []),
    { label: t("desktop.menu.file"), submenu: fileSubmenu },
    {
      label: t("desktop.menu.edit"),
      submenu: [
        { role: "undo", label: t("desktop.menu.undo") },
        { role: "redo", label: t("desktop.menu.redo") },
        { type: "separator" },
        { role: "cut", label: t("desktop.menu.cut") },
        { role: "copy", label: t("desktop.menu.copy") },
        { role: "paste", label: t("desktop.menu.paste") },
        { role: "selectAll", label: t("desktop.menu.selectAll") },
      ],
    },
    {
      label: t("desktop.menu.view"),
      submenu: [
        { role: "resetZoom", label: t("desktop.menu.resetZoom") },
        { role: "zoomIn", label: t("desktop.menu.zoomIn") },
        { role: "zoomOut", label: t("desktop.menu.zoomOut") },
        { type: "separator" },
        {
          role: "togglefullscreen",
          label: t("desktop.menu.toggleFullScreen"),
        },
        ...(app.isPackaged
          ? []
          : ([
              { type: "separator" },
              {
                role: "toggleDevTools",
                label: t("desktop.menu.toggleDevTools"),
              },
            ] satisfies MenuItemConstructorOptions[])),
      ],
    },
    {
      label: t("desktop.menu.window"),
      role: "windowMenu",
      submenu: [
        { role: "minimize", label: t("desktop.menu.minimize") },
        { role: "zoom", label: t("desktop.menu.zoom") },
        { role: "close", label: t("desktop.menu.close") },
        ...(process.platform === "darwin"
          ? ([
              { type: "separator" },
              { role: "front", label: t("desktop.menu.front") },
            ] satisfies MenuItemConstructorOptions[])
          : []),
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
};

const createWindow = (origin: string): BrowserWindow => {
  const state = readWindowState();
  const window = new BrowserWindow({
    x: state?.x,
    y: state?.y,
    width: state?.width ?? 1280,
    height: state?.height ?? 860,
    minWidth: 900,
    minHeight: 600,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Chromiums eingebauter PDF-Viewer (Abrechnungs-Tab nutzt <object>)
      plugins: true,
    },
  });

  if (state?.maximized) {
    window.maximize();
  }
  window.once("ready-to-show", () => {
    window.show();
  });
  window.on("close", () => {
    saveWindowState(window);
  });

  // Externe Links gehören in den System-Browser, nicht ins App-Fenster.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(origin)) {
      return { action: "allow" };
    }
    shell.openExternal(url).catch(() => undefined);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(origin)) {
      event.preventDefault();
      shell.openExternal(url).catch(() => undefined);
    }
  });

  window.loadURL(origin).catch(() => undefined);

  return window;
};

const init = async (): Promise<void> => {
  backupOnVersionChange();

  const { port, token } = await startApi();
  const origin = `http://127.0.0.1:${port}`;
  appOrigin = origin;

  // Ohne Login schützt allein dieses Token den Loopback-Port: der Header wird
  // in alle Requests des App-Fensters injiziert, die API lehnt Requests ohne
  // gültiges Token ab (siehe apps/api/src/main.ts).
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: [`${origin}/*`] },
    (details, callback) => {
      details.requestHeaders["x-loopback-token"] = token;
      callback({ requestHeaders: details.requestHeaders });
    },
  );

  await waitForApi(port, token);

  Menu.setApplicationMenu(buildMenu());
  mainWindow = createWindow(origin);
};

// Zwei Instanzen hieße: zwei Prozesse auf derselben SQLite-Datei. Der zweite
// Start fokussiert stattdessen das bestehende Fenster.
if (app.requestSingleInstanceLock()) {
  app.on("second-instance", () => {
    if (mainWindow !== null) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  app.on("before-quit", () => {
    quitting = true;
    apiProcess?.kill();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    // macOS: Klick aufs Dock-Icon öffnet das Fenster wieder (API läuft noch).
    if (BrowserWindow.getAllWindows().length === 0 && appOrigin !== null) {
      mainWindow = createWindow(appOrigin);
    }
  });

  app
    .whenReady()
    .then(init)
    .catch((error: unknown) => {
      dialog.showErrorBox(
        t("desktop.error.apiStartTitle"),
        error instanceof Error
          ? `${t("desktop.error.apiStartMessage")}\n\n${error.message}`
          : t("desktop.error.apiStartMessage"),
      );
      app.quit();
    });
} else {
  app.quit();
}
