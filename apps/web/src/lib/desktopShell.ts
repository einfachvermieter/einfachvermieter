/**
 * Brücke des Preload-Skripts der Desktop-App. Fehlt im Browser und im
 * Docker-Betrieb, dann bleibt die Oberfläche wie gehabt.
 */
type DesktopShellBridge = {
  platform: string;
  openMenu: (menuId: string, x: number, y: number) => void;
  onFullScreenChange: (callback: (fullScreen: boolean) => void) => () => void;
};

const bridge = (window as { desktopShell?: DesktopShellBridge }).desktopShell;

const platformNames: Record<string, "mac" | "win"> = {
  darwin: "mac",
  win32: "win",
};

/**
 * System der Desktop-App, `undefined` außerhalb davon. Die Plattformstile
 * hängen am daraus gesetzten `data-desktop` am `<html>`.
 */
export const desktopPlatform: "mac" | "win" | undefined = bridge
  ? platformNames[bridge.platform]
  : undefined;

/**
 * Öffnet ein Menü des Anwendungsmenüs an der Stelle (CSS-Pixel im Fenster)
 */
export const openDesktopMenu = (menuId: string, x: number, y: number): void => {
  bridge?.openMenu(menuId, x, y);
};

/**
 * Meldet Wechsel in und aus dem Vollbild; liefert die Abmeldung zurück
 */
export const onDesktopFullScreenChange = (
  callback: (fullScreen: boolean) => void,
): (() => void) => bridge?.onFullScreenChange?.(callback) ?? (() => undefined);
