import type { Response } from "express";
import { AUTH_COOKIE_NAME } from "./const.js";

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
    secure: process.env.NODE_ENV === "production",
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
