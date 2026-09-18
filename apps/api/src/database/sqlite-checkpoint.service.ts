import { detectDialect } from "@einfachvermieter/db";
import { EntityManager } from "@mikro-orm/core";
import { Injectable, type OnApplicationShutdown } from "@nestjs/common";

/**
 * Schreibt beim Beenden das WAL in die Datenbankdatei zurück.
 */
@Injectable()
export class SqliteCheckpointService implements OnApplicationShutdown {
  constructor(private readonly em: EntityManager) {}

  async onApplicationShutdown(): Promise<void> {
    if (detectDialect() !== "libsql") {
      return;
    }

    try {
      await this.em.getConnection().execute("pragma wal_checkpoint(truncate)");
    } catch {
      // Der Stand geht nicht verloren, er bleibt nur im WAL
      // und wird beim nächsten Start gelesen.
    }
  }
}
