import { Migration } from '@mikro-orm/migrations';
import { transferHeatingPeriodValues } from '../heatingPeriodValuesTransfer.ts';

export class Migration20261005191621 extends Migration {

  override name = 'Migration20261005191621';

  /**
   * MariaDB schreibt jeden Schema-Befehl sofort fest und rollt ihn bei einem
   * Abbruch nicht zurück. Die Migration ist deshalb so gebaut, dass sie nach
   * einem Abbruch an jeder Stelle erneut durchläuft: Die Tabelle entsteht in
   * einem einzigen Befehl und nur, wenn sie fehlt; die Übernahme beginnt
   * immer mit leerer Tabelle; und sie läuft nur, solange die alten Spalten
   * noch da sind. Sind sie schon entfernt, war die Übernahme vollständig.
   */
  override async up(): Promise<void> {
    await this.execute(`create table if not exists \`heating_period_values\` (\`id\` varchar(255) not null, \`building_id\` varchar(255) not null, \`period_start\` varchar(255) not null, \`period_end\` varchar(255) not null, \`total_heat_energy_kwh\` double null, \`district_heat_emissions_kg_per_year\` double null, \`district_heat_primary_energy_factor\` double null, \`created_at\` varchar(255) not null default current_timestamp(), \`updated_at\` varchar(255) not null default current_timestamp(), primary key (\`id\`), index \`heating_period_values_building_id_index\` (\`building_id\`), unique \`heating_period_values_building_period_unique\` (\`building_id\`, \`period_start\`, \`period_end\`), constraint \`heating_period_values_building_id_foreign\` foreign key (\`building_id\`) references \`buildings\` (\`id\`) on delete cascade) default character set utf8mb4 engine = InnoDB;`);

    const [oldColumn] = await this.execute(
      `select count(*) as present from information_schema.columns where table_schema = database() and table_name = 'heating_settings' and column_name = 'total_heat_energy_kwh'`,
    );
    if (Number(oldColumn?.present ?? 0) === 0) {
      return;
    }

    await this.execute(`delete from \`heating_period_values\`;`);
    await transferHeatingPeriodValues((sql, params) =>
      this.execute(sql, params),
    );

    await this.execute(`alter table \`heating_settings\` drop column \`total_heat_energy_kwh\`, drop column \`district_heat_emissions_kg_per_year\`, drop column \`district_heat_primary_energy_factor\`;`);
  }

  /**
   * Nicht verlustfrei: Die Werte je Zeitraum gehen verloren, die Spalten
   * kommen leer zurück. Eine Version kann mehrere Zeiträume mit verschiedenen
   * Werten abdecken, ein Rückschreiben ist deshalb nicht möglich. Der Rückweg
   * nach einem Update ist die Sicherung der Datenbank.
   */
  override down(): void | Promise<void> {
    this.addSql(`drop table if exists \`heating_period_values\`;`);

    this.addSql(`alter table \`heating_settings\` add \`total_heat_energy_kwh\` double null, add \`district_heat_emissions_kg_per_year\` double null, add \`district_heat_primary_energy_factor\` double null;`);
  }

}
