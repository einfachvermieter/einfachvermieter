import { Migration } from '@mikro-orm/migrations';

export class Migration20261006163955 extends Migration {

  override name = 'Migration20261006163955';

  override up(): void | Promise<void> {
    this.addSql(`alter table \`cost_entry_items\` add column \`co2_energy_kwh\` double null;`);
    this.addSql(`alter table \`cost_entry_items\` add column \`co2_emission_factor_kg_per_kwh\` double null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`cost_entry_items\` drop column \`co2_energy_kwh\`;`);
    this.addSql(`alter table \`cost_entry_items\` drop column \`co2_emission_factor_kg_per_kwh\`;`);
  }

}
