import { Migration } from '@mikro-orm/migrations';

export class Migration20261016190129 extends Migration {

  override name = 'Migration20261016190129';

  /**
   * Bestehende Konfigurationen rechneten immer nach der Fläche der beheizten
   * Räume und behalten diesen Maßstab. Neue Zeilen beginnen mit der
   * Wohnfläche; den Default ändert SQLite nur über einen Neuaufbau der
   * Tabelle.
   */
  override up(): void | Promise<void> {
    this.addSql(`update \`heating_settings\` set \`base_method\` = 'heated_area' where \`base_method\` = 'area';`);
    this.addSql(`pragma foreign_keys = off;`);
    this.addSql(`create table \`heating_settings__temp_alter\` (\`id\` text not null primary key, \`building_id\` text not null, \`mode\` text not null, \`base_share_percent\` integer not null default 30, \`consumption_share_percent\` integer not null default 70, \`base_method\` text not null default 'living_area', \`consumption_method\` text not null default 'heat_meter', \`proration_method\` text not null default 'linear', \`heating_type\` text not null default 'central_without_hot_water', \`fuel_type\` text not null default 'gas', \`hot_water_meter_id\` text null, \`hot_water_supply_temperature_celsius\` integer not null default 60, \`gas_billing_by_calorific_value\` integer not null default false, \`heat_pump_monovalent\` integer not null default false, \`mandatory_seventy_percent\` integer not null default false, \`include_billing_info\` integer not null default true, \`co2_cost_share_enabled\` integer not null default true, \`co2_building_restricted\` integer not null default false, \`co2_supply_restricted\` integer not null default false, \`co2_restriction_evidence_note\` text null, \`valid_from\` text not null default '1900-01-01', \`valid_to\` text null, \`created_at\` text not null default current_timestamp, \`updated_at\` text not null default current_timestamp, constraint \`heating_settings_building_id_foreign\` foreign key (\`building_id\`) references \`buildings\` (\`id\`) on delete restrict, constraint \`heating_settings_hot_water_meter_id_foreign\` foreign key (\`hot_water_meter_id\`) references \`meters\` (\`id\`) on delete set null);`);
    this.addSql(`insert into \`heating_settings__temp_alter\` select \`id\`, \`building_id\`, \`mode\`, \`base_share_percent\`, \`consumption_share_percent\`, \`base_method\`, \`consumption_method\`, \`proration_method\`, \`heating_type\`, \`fuel_type\`, \`hot_water_meter_id\`, \`hot_water_supply_temperature_celsius\`, \`gas_billing_by_calorific_value\`, \`heat_pump_monovalent\`, \`mandatory_seventy_percent\`, \`include_billing_info\`, \`co2_cost_share_enabled\`, \`co2_building_restricted\`, \`co2_supply_restricted\`, \`co2_restriction_evidence_note\`, \`valid_from\`, \`valid_to\`, \`created_at\`, \`updated_at\` from \`heating_settings\`;`);
    this.addSql(`drop table \`heating_settings\`;`);
    this.addSql(`alter table \`heating_settings__temp_alter\` rename to \`heating_settings\`;`);
    this.addSql(`create index \`heating_settings_building_id_index\` on \`heating_settings\` (\`building_id\`);`);
    this.addSql(`create index \`heating_settings_hot_water_meter_id_index\` on \`heating_settings\` (\`hot_water_meter_id\`);`);
    this.addSql(`create unique index \`heating_settings_building_id_valid_from_unique\` on \`heating_settings\` (\`building_id\`, \`valid_from\`);`);
    this.addSql(`pragma foreign_keys = on;`);
  }

  /**
   * Nicht verlustfrei: Der gewählte Maßstab geht verloren, beide Werte werden
   * wieder zu 'area'.
   */
  override down(): void | Promise<void> {
    this.addSql(`update \`heating_settings\` set \`base_method\` = 'area';`);
    this.addSql(`pragma foreign_keys = off;`);
    this.addSql(`create table \`heating_settings__temp_alter\` (\`id\` TEXT not null primary key, \`building_id\` TEXT not null, \`mode\` TEXT not null, \`base_share_percent\` INTEGER not null default 30, \`consumption_share_percent\` INTEGER not null default 70, \`base_method\` TEXT not null default 'area', \`consumption_method\` TEXT not null default 'heat_meter', \`proration_method\` TEXT not null default 'linear', \`heating_type\` TEXT not null default 'central_without_hot_water', \`fuel_type\` TEXT not null default 'gas', \`hot_water_meter_id\` TEXT null, \`hot_water_supply_temperature_celsius\` INTEGER not null default 60, \`gas_billing_by_calorific_value\` INTEGER not null default false, \`heat_pump_monovalent\` INTEGER not null default false, \`mandatory_seventy_percent\` INTEGER not null default false, \`include_billing_info\` INTEGER not null default true, \`co2_cost_share_enabled\` INTEGER not null default true, \`valid_from\` TEXT not null default '1900-01-01', \`valid_to\` TEXT null, \`created_at\` TEXT not null default current_timestamp, \`updated_at\` TEXT not null default current_timestamp, \`co2_building_restricted\` INTEGER not null default false, \`co2_supply_restricted\` INTEGER not null default false, \`co2_restriction_evidence_note\` TEXT null, constraint \`heating_settings_hot_water_meter_id_foreign\` foreign key (\`hot_water_meter_id\`) references \`meters\` (\`id\`) on update no action on delete set null, constraint \`heating_settings_building_id_foreign\` foreign key (\`building_id\`) references \`buildings\` (\`id\`) on update no action on delete restrict);`);
    this.addSql(`insert into \`heating_settings__temp_alter\` select \`id\`, \`building_id\`, \`mode\`, \`base_share_percent\`, \`consumption_share_percent\`, \`base_method\`, \`consumption_method\`, \`proration_method\`, \`heating_type\`, \`fuel_type\`, \`hot_water_meter_id\`, \`hot_water_supply_temperature_celsius\`, \`gas_billing_by_calorific_value\`, \`heat_pump_monovalent\`, \`mandatory_seventy_percent\`, \`include_billing_info\`, \`co2_cost_share_enabled\`, \`valid_from\`, \`valid_to\`, \`created_at\`, \`updated_at\`, \`co2_building_restricted\`, \`co2_supply_restricted\`, \`co2_restriction_evidence_note\` from \`heating_settings\`;`);
    this.addSql(`drop table \`heating_settings\`;`);
    this.addSql(`alter table \`heating_settings__temp_alter\` rename to \`heating_settings\`;`);
    this.addSql(`create unique index \`heating_settings_building_id_valid_from_unique\` on \`heating_settings\` (\`building_id\`, \`valid_from\`);`);
    this.addSql(`create index \`heating_settings_hot_water_meter_id_index\` on \`heating_settings\` (\`hot_water_meter_id\`);`);
    this.addSql(`create index \`heating_settings_building_id_index\` on \`heating_settings\` (\`building_id\`);`);
    this.addSql(`pragma foreign_keys = on;`);
  }

}
