import { contextBridge, ipcRenderer } from "electron";

/**
 * Fensterfunktionen für die Web-App: das System für die Plattformstile,
 * das Öffnen des Anwendungsmenüs aus der selbst gezeichneten
 * Windows-Titelleiste und der Vollbild-Zustand (auf dem Mac verschwinden
 * dann die Ampel-Buttons).
 */
contextBridge.exposeInMainWorld("desktopShell", {
  platform: process.platform,
  openMenu: (menuId: string, x: number, y: number): void => {
    ipcRenderer.send("desktop-shell:open-menu", menuId, x, y);
  },
  onFullScreenChange: (callback: (fullScreen: boolean) => void) => {
    const listener = (_event: unknown, fullScreen: boolean) =>
      callback(fullScreen);
    ipcRenderer.on("desktop-shell:full-screen", listener);
    return () => {
      ipcRenderer.removeListener("desktop-shell:full-screen", listener);
    };
  },
});
