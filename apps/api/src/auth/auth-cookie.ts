import type { Response } from "express";
import { AUTH_COOKIE_NAME, SESSION_TTL_MS } from "./const.js";

/**
 * Setzt das Session-Cookie mit dem rohen Token (Login + Ersteinrichtung)
 */
export const setAuthCookie = (response: Response, token: string): void => {
  response.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_MS,
  });
};

/**
 * Entfernt das Session-Cookie (Logout)
 */
export const clearAuthCookie = (response: Response): void => {
  response.clearCookie(AUTH_COOKIE_NAME);
};
