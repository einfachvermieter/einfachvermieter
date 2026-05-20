/**
 * Konsistenz-Kommando gegen Dateileichen im Uploads-Store.
 *
 * Datei-Deletes laufen best-effort nach dem DB-Flush (siehe
 * AttachmentsService/SettingsService). Schlägt ein Delete fehl, bleibt die
 * Datei liegen, obwohl keine DB-Zeile mehr auf sie zeigt. Dieses Kommando
 * gleicht die Keys auf der Platte gegen die referenzierten Keys in der DB ab
 * und meldet (bzw. löscht mit `--apply`) die Waisen.
 *
 * Liegt bewusst unter `src/` (nicht `scripts/`), damit `nest build` es nach
 * `dist/` kompiliert und es im Produktions-Image landet. Aufruf dort:
 *   node apps/api/dist/prune-attachments.js [--apply]
 * In Dev via `npm run prune:attachments -w @einfachvermieter/api [-- --apply]`.
 * Ohne `--apply` nur Trockenlauf (nichts wird gelöscht).
 */

import {
  AppSettingsSchema,
  CostEntryAttachmentSchema,
  initOrm,
} from "@einfachvermieter/db";
import {
  debugKeyFor,
  StorageService,
  uploadsBaseDir,
} from "./storage/storage.service.js";

const apply = process.argv.includes("--apply");

const main = async () => {
  const orm = await initOrm();
  const em = orm.em.fork();
  const storage = new StorageService(uploadsBaseDir());

  try {
    const attachments = await em.find(
      CostEntryAttachmentSchema,
      {},
      { fields: ["storageKey"] },
    );
    const settings = await em.find(
      AppSettingsSchema,
      {},
      { fields: ["logoStorageKey"] },
    );

    // Gültig sind referenzierte Keys plus der `.debug`-Sidecar je Anhang.
    const referenced = new Set<string>();
    for (const attachment of attachments) {
      referenced.add(attachment.storageKey);
      referenced.add(debugKeyFor(attachment.storageKey));
    }
    for (const row of settings) {
      if (row.logoStorageKey) {
        referenced.add(row.logoStorageKey);
      }
    }

    const onDisk = await storage.listKeys();
    const orphans = onDisk.filter((key) => !referenced.has(key));

    if (orphans.length === 0) {
      console.log("[prune-attachments] OK - keine verwaisten Dateien.");
      return;
    }

    for (const key of orphans) {
      console.log(
        `[prune-attachments] ${apply ? "lösche" : "verwaist"}: ${key}`,
      );
      if (apply) {
        await storage.delete(key);
      }
    }
    console.log(
      apply
        ? `[prune-attachments] ${orphans.length} verwaiste Datei(en) gelöscht.`
        : `[prune-attachments] ${orphans.length} verwaiste Datei(en) gefunden. Mit --apply löschen.`,
    );
  } finally {
    await orm.close(true);
  }
};

main().catch((err) => {
  console.error("[prune-attachments] Abbruch:", err);
  process.exit(2);
});
