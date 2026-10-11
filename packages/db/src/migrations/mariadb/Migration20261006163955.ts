import { Migration } from '@mikro-orm/migrations';

export class Migration20261006163955 extends Migration {

  override name = 'Migration20261006163955';

  /**
   * Ein Befehl mit `if not exists`, damit die Migration auf MariaDB nach
   * einem Abbruch erneut durchläuft.
   */
  override up(): void | Promise<void> {
    this.addSql(`alter table \`cost_entry_items\` add column if not exists \`co2_energy_kwh\` double null, add column if not exists \`co2_emission_factor_kg_per_kwh\` double null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`cost_entry_items\` drop column \`co2_energy_kwh\`, drop column \`co2_emission_factor_kg_per_kwh\`;`);
  }

}
