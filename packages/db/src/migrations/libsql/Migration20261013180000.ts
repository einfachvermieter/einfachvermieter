import { Migration } from '@mikro-orm/migrations';

export class Migration20261013180000 extends Migration {

  override name = 'Migration20261013180000';

  override up(): void | Promise<void> {
    this.addSql(`alter table \`heating_settings\` add column \`co2_building_restricted\` integer not null default false;`);
    this.addSql(`alter table \`heating_settings\` add column \`co2_supply_restricted\` integer not null default false;`);
    this.addSql(`alter table \`heating_settings\` add column \`co2_restriction_evidence_note\` text null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`heating_settings\` drop column \`co2_building_restricted\`;`);
    this.addSql(`alter table \`heating_settings\` drop column \`co2_supply_restricted\`;`);
    this.addSql(`alter table \`heating_settings\` drop column \`co2_restriction_evidence_note\`;`);
  }

}
