/**
 * Vorabversion, erkennbar am Suffix der Versionsnummer (2026.1.0-beta.1).
 * Schaltet die Beta-Kennzeichnung in der Oberfläche ein.
 */
export const isPrerelease = __APP_VERSION__.includes("-");

export const BETA_NOTICE_OPEN_EVENT = "betanotice:open";

/**
 * Öffnet den Beta-Hinweis erneut, etwa per Klick auf das Beta-Kennzeichen.
 */
export const openBetaNotice = () => {
  window.dispatchEvent(new Event(BETA_NOTICE_OPEN_EVENT));
};
