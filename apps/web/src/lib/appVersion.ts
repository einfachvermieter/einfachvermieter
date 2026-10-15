/**
 * Vorabversion, erkennbar am Suffix der Versionsnummer (2026.1.0-beta.1).
 */
export const isPrerelease = __APP_VERSION__.includes("-");

const SCREENSHOT_MODE_KEY = "screenshotMode";

/**
 * Screenshot-Modus für Anleitung:
 * `sessionStorage.setItem("screenshotMode", "1")`
 * Blendet die Beta-Kennzeichnung und die Entwicklerwerkzeuge aus.
 */
export const isScreenshotMode = ((): boolean => {
  try {
    return sessionStorage.getItem(SCREENSHOT_MODE_KEY) === "1";
  } catch {
    return false;
  }
})();

export const showBetaMarker = isPrerelease && !isScreenshotMode;

export const ISSUES_URL =
  "https://github.com/einfachvermieter/einfachvermieter/issues";

export const BETA_NOTICE_OPEN_EVENT = "betanotice:open";

/**
 * Öffnet den Beta-Hinweis erneut, etwa per Klick auf das Beta-Kennzeichen.
 */
export const openBetaNotice = () => {
  window.dispatchEvent(new Event(BETA_NOTICE_OPEN_EVENT));
};

const BETA_NOTICE_SEEN_KEY = "betaNoticeSeen";

export const BETA_NOTICE_SEEN_EVENT = "betanotice:seen";

export const isBetaNoticeSeen = (): boolean => {
  try {
    return sessionStorage.getItem(BETA_NOTICE_SEEN_KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * Merkt den Beta-Hinweis für diese Sitzung als gelesen und meldet es, damit
 * Dialoge, die auf ihn warten, nachrücken.
 */
export const markBetaNoticeSeen = (): void => {
  try {
    sessionStorage.setItem(BETA_NOTICE_SEEN_KEY, "1");
  } catch {
    // ohne Speicher kein Merken
  }
  window.dispatchEvent(new Event(BETA_NOTICE_SEEN_EVENT));
};
