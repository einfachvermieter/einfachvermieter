import { Migration } from '@mikro-orm/migrations';
import { transferHeatingPeriodValues } from '../heatingPeriodValuesTransfer.ts';

export class Migration20261005191621 extends Migration {

  override name = 'Migration20261005191621';

  override async up(): Promise<void> {
    // Sofort ausführen statt sammeln: Die Übernahme braucht die neue Tabelle
    // und die alten Spalten zugleich.
    await this.execute(`create table "heating_period_values" ("id" varchar(255) not null, "building_id" varchar(255) not null, "period_start" varchar(255) not null, "period_end" varchar(255) not null, "total_heat_energy_kwh" double precision null, "district_heat_emissions_kg_per_year" double precision null, "district_heat_primary_energy_factor" double precision null, "created_at" varchar(255) not null default current_timestamp, "updated_at" varchar(255) not null default current_timestamp, primary key ("id"));`);
    await this.execute(`alter table "heating_period_values" add constraint "heating_period_values_building_period_unique" unique ("building_id", "period_start", "period_end");`);
    await this.execute(`alter table "heating_period_values" add constraint "heating_period_values_building_id_foreign" foreign key ("building_id") references "buildings" ("id") on delete cascade;`);

    await transferHeatingPeriodValues((sql, params) =>
      this.execute(sql, params),
    );

    await this.execute(`alter table "heating_settings" drop column "total_heat_energy_kwh", drop column "district_heat_emissions_kg_per_year", drop column "district_heat_primary_energy_factor";`);
  }

  /**
   * Nicht verlustfrei: Die Werte je Zeitraum gehen verloren, die Spalten
   * kommen leer zurück. Eine Version kann mehrere Zeiträume mit verschiedenen
   * Werten abdecken, ein Rückschreiben ist deshalb nicht möglich. Der Rückweg
   * nach einem Update ist die Sicherung der Datenbank.
   */
  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "heating_period_values" cascade;`);

    this.addSql(`alter table "heating_settings" add "total_heat_energy_kwh" float8 null, add "district_heat_emissions_kg_per_year" float8 null, add "district_heat_primary_energy_factor" float8 null;`);
  }

}
