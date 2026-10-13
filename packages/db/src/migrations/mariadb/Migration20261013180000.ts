import { Migration } from '@mikro-orm/migrations';

export class Migration20261013180000 extends Migration {

  override name = 'Migration20261013180000';

  /**
   * Ein Befehl mit `if not exists`, damit die Migration auf MariaDB nach
   * einem Abbruch erneut durchläuft.
   */
  override up(): void | Promise<void> {
    this.addSql(`alter table \`heating_settings\` add column if not exists \`co2_building_restricted\` tinyint(1) not null default false, add column if not exists \`co2_supply_restricted\` tinyint(1) not null default false, add column if not exists \`co2_restriction_evidence_note\` text null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`heating_settings\` drop column \`co2_building_restricted\`, drop column \`co2_supply_restricted\`, drop column \`co2_restriction_evidence_note\`;`);
  }

}
