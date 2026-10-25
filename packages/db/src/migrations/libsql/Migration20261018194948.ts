import { Migration } from '@mikro-orm/migrations';

export class Migration20261018194948 extends Migration {

  override name = 'Migration20261018194948';

  override up(): void | Promise<void> {
    this.addSql(`alter table \`heating_settings\` add column \`seventy_insulation_answer\` text null;`);
    this.addSql(`alter table \`heating_settings\` add column \`seventy_pipes_answer\` text null;`);
    this.addSql(`alter table \`heating_settings\` add column \`co2_building_restriction_answer\` text null;`);
    this.addSql(`alter table \`heating_settings\` add column \`co2_supply_restriction_answer\` text null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`heating_settings\` drop column \`seventy_insulation_answer\`;`);
    this.addSql(`alter table \`heating_settings\` drop column \`seventy_pipes_answer\`;`);
    this.addSql(`alter table \`heating_settings\` drop column \`co2_building_restriction_answer\`;`);
    this.addSql(`alter table \`heating_settings\` drop column \`co2_supply_restriction_answer\`;`);
  }

}
