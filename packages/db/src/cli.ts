/**
 * Kompilierte DB-CLI für Produktions-Container (dort gibt es kein `tsx`,
 * nur `node` + `dist/`). Deckt die Betriebsfälle ab, die im Container
 * anfallen - die Dev-Workflows (schema:fresh, Seeds) bleiben in `scripts/`.
 *
 *   node packages/db/dist/cli.js migrate
 *     -> Datenbank anlegen (falls nötig) + ausstehende Migrationen anwenden.
 *
 *   node packages/db/dist/cli.js bootstrap-admin
 *     -> AppSettings-Singleton + ersten Admin-User anlegen, falls noch kein
 *       User existiert (Erststart). Zugangsdaten aus ADMIN_EMAIL und
 *       ADMIN_PASSWORD; idempotent - mit vorhandenen Usern passiert nichts.
 */

import {
  passwordPolicyFromEnv,
  passwordSchema,
} from "@einfachvermieter/shared";
import {
  APP_SETTINGS_ID,
  AppSettingsSchema,
  UserSchema,
} from "./entities/index.js";
import { initOrm } from "./orm.js";
import { hashPassword } from "./password.js";

/**
 * Beschreibt die aktive Policy in Klartext fürs CLI-Feedback (kein i18n hier).
 */
const describePolicy = (env: NodeJS.ProcessEnv): string => {
  const policy = passwordPolicyFromEnv(env);
  const parts = [`mindestens ${policy.minLength} Zeichen`];

  if (policy.requireUppercase) {
    parts.push("Großbuchstabe");
  }

  if (policy.requireLowercase) {
    parts.push("Kleinbuchstabe");
  }

  if (policy.requireDigit) {
    parts.push("Ziffer");
  }

  if (policy.requireSpecial) {
    parts.push("Sonderzeichen");
  }

  return parts.join(", ");
};

const migrate = async (): Promise<void> => {
  const orm = await initOrm();
  try {
    await orm.schema.ensureDatabase();
    const applied = await orm.migrator.up();
    console.log(
      applied.length > 0
        ? `${applied.length} Migration(en) angewendet`
        : "keine ausstehenden Migrationen",
    );
  } finally {
    await orm.close(true);
  }
};

const bootstrapAdmin = async (): Promise<void> => {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  const orm = await initOrm();
  try {
    const em = orm.em.fork();

    const userCount = await em.count(UserSchema, {});
    if (userCount > 0) {
      console.log("bootstrap-admin: User existieren bereits - übersprungen");
      return;
    }

    if (!email || !password) {
      console.error(
        "bootstrap-admin: ADMIN_EMAIL und ADMIN_PASSWORD müssen gesetzt sein",
      );
      process.exitCode = 1;
      return;
    }
    const policy = passwordPolicyFromEnv(process.env);
    if (!passwordSchema(policy).safeParse(password).success) {
      console.error(
        `bootstrap-admin: ADMIN_PASSWORD erfüllt die Richtlinie nicht (${describePolicy(process.env)})`,
      );
      process.exitCode = 1;
      return;
    }

    const settings = await em.findOne(AppSettingsSchema, {
      id: APP_SETTINGS_ID,
    });

    if (!settings) {
      // Absenderdaten bleiben leer, sie werden nach dem ersten Login gepflegt
      em.persist(
        em.create(AppSettingsSchema, {
          id: APP_SETTINGS_ID,
          senderName: "",
          senderAddressStreet: "",
          senderAddressPostalCode: "",
          senderAddressCity: "",
          logoMode: "none",
        }),
      );
    }

    em.persist(
      em.create(UserSchema, {
        email,
        passwordHash: await hashPassword(password),
        role: "admin",
      }),
    );

    await em.flush();

    console.log(`bootstrap-admin: Admin-User "${email}" angelegt`);
  } finally {
    await orm.close(true);
  }
};

const action = process.argv[2] ?? "migrate";
if (action === "migrate") {
  await migrate();
} else if (action === "bootstrap-admin") {
  await bootstrapAdmin();
} else {
  console.error(
    `Unbekanntes Kommando "${action}" - verfügbar: migrate, bootstrap-admin`,
  );

  process.exitCode = 1;
}
