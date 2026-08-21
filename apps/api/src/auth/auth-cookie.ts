import type { Response } from "express";
import { AUTH_COOKIE_NAME } from "./const.js";

/**
 * Secure-Flag fürs Session-Cookie: folgt der Verbindung (`req.secure`),
 * COOKIE_SECURE=true|false erzwingt es.
 */
const isSecureCookie = (response: Response): boolean => {
  const forced = process.env.COOKIE_SECURE;
  if (forced === "true" || forced === "false") {
    return forced === "true";
  }
  return response.req.secure;
};

/**
 * Setzt das Session-Cookie mit dem rohen Token (Login + Ersteinrichtung).
 * Mit `expiresAt` läuft das Cookie zu diesem Zeitpunkt ab (wie DB-Session);
 * ohne wird ein Session-Cookie gesetzt.
 */
export const setAuthCookie = (
  response: Response,
  token: string,
  expiresAt?: Date,
): void => {
  response.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecureCookie(response),
    sameSite: "lax",
    ...(expiresAt ? { expires: expiresAt } : {}),
  });
};

/**
 * Entfernt das Session-Cookie (Logout)
 */
export const clearAuthCookie = (response: Response): void => {
  response.clearCookie(AUTH_COOKIE_NAME);
};
