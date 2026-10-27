import { Migration } from '@mikro-orm/migrations';

export class Migration20261027192733 extends Migration {

  override name = 'Migration20261027192733';

  /**
   * Mietart am Vertrag, Änderungsgrund am Mietsatz. Die bisherige
   * Begründung einer Reduktion wird zur Notiz. Sie beschrieb eine
   * vereinbarte Senkung, deshalb bekommen Zeilen mit Notiz den Grund
   * "Vereinbarung". Der erste Satz eines Vertrags hat keinen Vorgänger
   * und bleibt ohne Grund, seine Notiz bleibt erhalten.
   */
  override up(): void | Promise<void> {
    this.addSql(`alter table "tenants" add "rent_type" varchar(255) not null default 'standard';`);

    this.addSql(`alter table "tenant_rents" add "change_reason" varchar(255) null;`);
    this.addSql(`alter table "tenant_rents" rename column "reduction_reason" to "change_note";`);
    this.addSql(`update "tenant_rents" set "change_reason" = 'agreement' where "change_note" is not null and trim("change_note") <> '' and "start_date" is not null and exists (select 1 from "tenant_rents" as "earlier" where "earlier"."tenant_id" = "tenant_rents"."tenant_id" and ("earlier"."start_date" is null or "earlier"."start_date" < "tenant_rents"."start_date"));`);
  }

  /**
   * Verliert Grund und Mietart.
   */
  override down(): void | Promise<void> {
    this.addSql(`alter table "tenant_rents" drop column "change_reason";`);
    this.addSql(`alter table "tenant_rents" rename column "change_note" to "reduction_reason";`);

    this.addSql(`alter table "tenants" drop column "rent_type";`);
  }

}
