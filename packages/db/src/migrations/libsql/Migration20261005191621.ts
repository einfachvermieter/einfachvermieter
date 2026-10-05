import { Migration } from '@mikro-orm/migrations';
import { transferHeatingPeriodValues } from '../heatingPeriodValuesTransfer.ts';

export class Migration20261005191621 extends Migration {

  override name = 'Migration20261005191621';

  override async up(): Promise<void> {
    // Sofort ausführen statt sammeln: Die Übernahme braucht die neue Tabelle
    // und die alten Spalten zugleich.
    await this.execute(`create table \`heating_period_values\` (\`id\` text not null primary key, \`building_id\` text not null, \`period_start\` text not null, \`period_end\` text not null, \`total_heat_energy_kwh\` double null, \`district_heat_emissions_kg_per_year\` double null, \`district_heat_primary_energy_factor\` double null, \`created_at\` text not null default current_timestamp, \`updated_at\` text not null default current_timestamp, constraint \`heating_period_values_building_id_foreign\` foreign key (\`building_id\`) references \`buildings\` (\`id\`) on delete cascade);`);
    await this.execute(`create index \`heating_period_values_building_id_index\` on \`heating_period_values\` (\`building_id\`);`);
    await this.execute(`create unique index \`heating_period_values_building_period_unique\` on \`heating_period_values\` (\`building_id\`, \`period_start\`, \`period_end\`);`);

    await transferHeatingPeriodValues((sql, params) =>
      this.execute(sql, params),
    );

    await this.execute(`alter table \`heating_settings\` drop column \`total_heat_energy_kwh\`;`);
    await this.execute(`alter table \`heating_settings\` drop column \`district_heat_emissions_kg_per_year\`;`);
    await this.execute(`alter table \`heating_settings\` drop column \`district_heat_primary_energy_factor\`;`);
  }

  /**
   * Nicht verlustfrei: Die Werte je Zeitraum gehen verloren, die Spalten
   * kommen leer zurück. Eine Version kann mehrere Zeiträume mit verschiedenen
   * Werten abdecken, ein Rückschreiben ist deshalb nicht möglich. Der Rückweg
   * nach einem Update ist die Sicherung der Datenbank.
   */
  override down(): void | Promise<void> {
    this.addSql(`drop table if exists \`heating_period_values\`;`);

    this.addSql(`alter table \`heating_settings\` add column \`total_heat_energy_kwh\` double null;`);
    this.addSql(`alter table \`heating_settings\` add column \`district_heat_emissions_kg_per_year\` double null;`);
    this.addSql(`alter table \`heating_settings\` add column \`district_heat_primary_energy_factor\` double null;`);
  }

}
