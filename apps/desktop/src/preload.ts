import { contextBridge, ipcRenderer } from "electron";

/**
 * Fensterfunktionen für die Web-App: das System für die Plattformstile und
 * der Vollbild-Zustand (auf dem Mac verschwinden dann die Ampel-Buttons).
 */
contextBridge.exposeInMainWorld("desktopShell", {
  platform: process.platform,
  onFullScreenChange: (callback: (fullScreen: boolean) => void) => {
    const listener = (_event: unknown, fullScreen: boolean) =>
      callback(fullScreen);
    ipcRenderer.on("desktop-shell:full-screen", listener);
    return () => {
      ipcRenderer.removeListener("desktop-shell:full-screen", listener);
    };
  },
});
