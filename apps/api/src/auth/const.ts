/**
 * HTTP Cookie Name
 */
export const AUTH_COOKIE_NAME = "EVAuth";

const DEFAULT_SESSION_TTL_DAYS = 7;

/**
 * Session-Lebensdauer ab Ausstellung für Cookie und DB-Session. ENV
 * `SESSION_TTL_DAYS` (positiver Integer) überschreibt den Default.
 */
const parsedSessionDays = Number.parseInt(
  process.env.SESSION_TTL_DAYS ?? "",
  10,
);

export const SESSION_TTL_MS =
  (Number.isFinite(parsedSessionDays) && parsedSessionDays > 0
    ? parsedSessionDays
    : DEFAULT_SESSION_TTL_DAYS) *
  24 *
  60 *
  60 *
  1000;
