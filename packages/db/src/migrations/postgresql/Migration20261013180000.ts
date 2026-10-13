import { Migration } from '@mikro-orm/migrations';

export class Migration20261013180000 extends Migration {

  override name = 'Migration20261013180000';

  override up(): void | Promise<void> {
    this.addSql(`alter table "heating_settings" add "co2_building_restricted" boolean not null default false, add "co2_supply_restricted" boolean not null default false, add "co2_restriction_evidence_note" text null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "heating_settings" drop column "co2_building_restricted", drop column "co2_supply_restricted", drop column "co2_restriction_evidence_note";`);
  }

}
