import { Migration } from '@mikro-orm/migrations';

export class Migration20261027192733 extends Migration {

  override name = 'Migration20261027192733';

  /**
   * Mietart am Vertrag, Änderungsgrund am Mietsatz. Die bisherige
   * Begründung einer Reduktion wird zur Notiz. Sie beschrieb eine
   * vereinbarte Senkung, deshalb bekommen Zeilen mit Notiz den Grund
   * "Vereinbarung". Der erste Satz eines Vertrags hat keinen Vorgänger
   * und bleibt ohne Grund, seine Notiz bleibt erhalten.
   *
   * Nach einem Abbruch auf MariaDB wiederholbar. Jede Tabelle ändert genau
   * ein `alter table`, das ganz oder gar nicht wirkt:
   * - Abbruch nach `tenants`: `if not exists` überspringt die Spalte.
   * - Abbruch nach `tenant_rents`: `if not exists` und `if exists`
   *   überspringen beide Änderungen, die alte Spalte gibt es nicht mehr.
   * - Abbruch nach dem `update` oder vor dem Eintrag der Migration: Das
   *   `update` setzt dieselben Zeilen erneut auf denselben Wert.
   */
  override up(): void | Promise<void> {
    this.addSql(`alter table \`tenants\` add column if not exists \`rent_type\` varchar(255) not null default 'standard';`);

    this.addSql(`alter table \`tenant_rents\` add column if not exists \`change_reason\` varchar(255) null, change column if exists \`reduction_reason\` \`change_note\` text null;`);
    this.addSql(`update \`tenant_rents\` set \`change_reason\` = 'agreement' where \`change_note\` is not null and trim(\`change_note\`) <> '' and \`start_date\` is not null and exists (select 1 from \`tenant_rents\` as \`earlier\` where \`earlier\`.\`tenant_id\` = \`tenant_rents\`.\`tenant_id\` and (\`earlier\`.\`start_date\` is null or \`earlier\`.\`start_date\` < \`tenant_rents\`.\`start_date\`));`);
  }

  /**
   * Verliert Grund und Mietart.
   */
  override down(): void | Promise<void> {
    this.addSql(`alter table \`tenants\` drop column \`rent_type\`;`);

    this.addSql(`alter table \`tenant_rents\` drop column \`change_reason\`;`);
    this.addSql(`alter table \`tenant_rents\` change \`change_note\` \`reduction_reason\` text null;`);
  }

}
