import argon2 from "argon2";

/**
 * Zentrale argon2id-Hash-Funktion (Passwörter). Genutzt von der API
 * (`auth.service.ts`), den Seed-Profilen und der kompilierten CLI
 * (`cli.ts`, bootstrap-admin)
 */
export const hashPassword = (plain: string): Promise<string> =>
  argon2.hash(plain, {
    // Argon2id mit 19 MiB (19456 KiB) ist OWASP-Empfehlung (Minimum)
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
