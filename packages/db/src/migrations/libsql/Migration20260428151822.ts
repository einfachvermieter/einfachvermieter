import { Migration } from '@mikro-orm/migrations';

export class Migration20260428151822 extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table \`app_settings\` (\`id\` text not null primary key default 'default', \`sender_name\` text not null default '', \`sender_address_street\` text not null default '', \`sender_address_postal_code\` text not null default '', \`sender_address_city\` text not null default '', \`sender_phone\` text null, \`sender_fax\` text null, \`sender_email\` text null, \`sender_bank_name\` text null, \`sender_bank_iban\` text null, \`sender_bank_bic\` text null, \`use_logo\` integer not null default true, \`logo_storage_key\` text null, \`logo_mime_type\` text null, \`ai_provider\` text null, \`ai_api_key\` text null, \`ai_base_url\` text null, \`ai_model\` text null, \`created_at\` text not null default current_timestamp, \`updated_at\` text not null default current_timestamp);`);

    this.addSql(`create table \`buildings\` (\`id\` text not null primary key, \`name\` text not null, \`address_street\` text not null, \`address_postal_code\` text not null, \`address_city\` text not null, \`created_at\` text not null default current_timestamp, \`updated_at\` text not null default current_timestamp);`);
    this.addSql(`create unique index \`buildings_name_unique\` on \`buildings\` (\`name\`);`);

    this.addSql(`create table \`cost_entries\` (\`id\` text not null primary key, \`invoice_date\` text not null, \`invoice_number\` text null, \`vendor\` text null, \`document_path\` text null, \`notes\` text null, \`created_at\` text not null default current_timestamp, \`updated_at\` text not null default current_timestamp);`);

    this.addSql(`create table \`cost_entry_attachments\` (\`id\` text not null primary key, \`cost_entry_id\` text not null, \`original_filename\` text not null, \`mime_type\` text not null, \`size_bytes\` integer not null, \`storage_key\` text not null, \`ocr_text\` text null, \`created_at\` text not null default current_timestamp, constraint \`cost_entry_attachments_cost_entry_id_foreign\` foreign key (\`cost_entry_id\`) references \`cost_entries\` (\`id\`) on delete cascade);`);
    this.addSql(`create index \`cost_entry_attachments_cost_entry_id\` on \`cost_entry_attachments\` (\`cost_entry_id\`);`);

    this.addSql(`create table \`cost_types\` (\`id\` text not null primary key, \`building_id\` text not null, \`name\` text not null, \`category\` text not null default 'operating', \`default_allocation_key\` text null, \`labor_cost_category\` text null, \`co2_tracked\` integer not null default false, \`is_metering_service_cost\` integer not null default false, \`description\` text null, \`created_at\` text not null default current_timestamp, \`updated_at\` text not null default current_timestamp, constraint \`cost_types_building_id_foreign\` foreign key (\`building_id\`) references \`buildings\` (\`id\`) on delete restrict);`);
    this.addSql(`create index \`cost_types_building_id\` on \`cost_types\` (\`building_id\`);`);

    this.addSql(`create table \`residents\` (\`id\` text not null primary key, \`first_name\` text not null, \`last_name\` text not null, \`email\` text null, \`phone\` text null, \`created_at\` text not null default current_timestamp, \`updated_at\` text not null default current_timestamp);`);

    this.addSql(`create table \`units\` (\`id\` text not null primary key, \`building_id\` text not null, \`name\` text not null, \`unit_number\` text null, \`area_sqm\` double not null, \`heating_area_sqm\` double null, \`created_at\` text not null default current_timestamp, \`updated_at\` text not null default current_timestamp, constraint \`units_building_id_foreign\` foreign key (\`building_id\`) references \`buildings\` (\`id\`) on delete restrict);`);
    this.addSql(`create index \`units_building_id_index\` on \`units\` (\`building_id\`);`);
    this.addSql(`create unique index \`units_building_name_unique\` on \`units\` (\`building_id\`, \`name\`);`);

    this.addSql(`create table \`tenants\` (\`id\` text not null primary key, \`unit_id\` text not null, \`kind\` text not null default 'private', \`start_date\` text not null, \`end_date\` text null, \`deposit_cents\` integer not null default 0, \`notes\` text null, \`created_at\` text not null default current_timestamp, \`updated_at\` text not null default current_timestamp, constraint \`tenants_unit_id_foreign\` foreign key (\`unit_id\`) references \`units\` (\`id\`) on delete restrict);`);
    this.addSql(`create index \`tenants_unit_id\` on \`tenants\` (\`unit_id\`);`);

    this.addSql(`create table \`tenant_residents\` (\`id\` text not null primary key, \`tenant_id\` text not null, \`resident_id\` text not null, \`move_in_date\` text null, \`move_out_date\` text null, \`is_contract_party\` integer not null default 1, \`created_at\` text not null default current_timestamp, \`updated_at\` text not null default current_timestamp, constraint \`tenant_residents_tenant_id_foreign\` foreign key (\`tenant_id\`) references \`tenants\` (\`id\`) on delete cascade, constraint \`tenant_residents_resident_id_foreign\` foreign key (\`resident_id\`) references \`residents\` (\`id\`) on delete restrict);`);
    this.addSql(`create index \`tenant_residents_tenant_id_index\` on \`tenant_residents\` (\`tenant_id\`);`);
    this.addSql(`create index \`tenant_residents_resident_id_index\` on \`tenant_residents\` (\`resident_id\`);`);
    this.addSql(`create unique index \`tenant_residents_tenant_resident_unique\` on \`tenant_residents\` (\`tenant_id\`, \`resident_id\`);`);

    this.addSql(`create table \`tenant_rents\` (\`id\` text not null primary key, \`tenant_id\` text not null, \`start_date\` text null, \`end_date\` text null, \`monthly_base_rent_cents\` integer not null, \`monthly_advance_cents\` integer not null, \`reduction_reason\` text null, \`created_at\` text not null default current_timestamp, \`updated_at\` text not null default current_timestamp, constraint \`tenant_rents_tenant_id_foreign\` foreign key (\`tenant_id\`) references \`tenants\` (\`id\`) on delete cascade);`);
    this.addSql(`create index \`tenant_rents_tenant_id\` on \`tenant_rents\` (\`tenant_id\`);`);

    this.addSql(`create table \`tenant_bank_accounts\` (\`id\` text not null primary key, \`tenant_id\` text not null, \`start_date\` text null, \`end_date\` text null, \`iban\` text not null, \`bic\` text null, \`account_holder\` text not null, \`mandate_reference\` text null, \`mandate_signed_at\` text null, \`created_at\` text not null default current_timestamp, \`updated_at\` text not null default current_timestamp, constraint \`tenant_bank_accounts_tenant_id_foreign\` foreign key (\`tenant_id\`) references \`tenants\` (\`id\`) on delete cascade);`);
    this.addSql(`create index \`tenant_bank_accounts_tenant_id\` on \`tenant_bank_accounts\` (\`tenant_id\`);`);

    this.addSql(`create table \`tenant_addresses\` (\`id\` text not null primary key, \`tenant_id\` text not null, \`start_date\` text null, \`end_date\` text null, \`street\` text not null, \`postal_code\` text not null, \`city\` text not null, \`created_at\` text not null default current_timestamp, \`updated_at\` text not null default current_timestamp, constraint \`tenant_addresses_tenant_id_foreign\` foreign key (\`tenant_id\`) references \`tenants\` (\`id\`) on delete cascade);`);
    this.addSql(`create index \`tenant_addresses_tenant_id\` on \`tenant_addresses\` (\`tenant_id\`);`);

    this.addSql(`create table \`payments\` (\`id\` text not null primary key, \`tenant_id\` text not null, \`payment_date\` text not null, \`reference\` text null, \`for_month\` text null, \`for_statement_id\` text null, \`for_deposit\` integer not null default false, \`for_fee_id\` text null, \`base_rent_cents\` integer null, \`advance_cents\` integer null, \`amount_cents\` integer null, \`created_at\` text not null default current_timestamp, \`updated_at\` text not null default current_timestamp, constraint \`payments_tenant_id_foreign\` foreign key (\`tenant_id\`) references \`tenants\` (\`id\`) on delete restrict);`);
    this.addSql(`create index \`payments_tenant_id\` on \`payments\` (\`tenant_id\`);`);

    this.addSql(`create table \`account_fees\` (\`id\` text not null primary key, \`tenant_id\` text not null, \`date\` text not null, \`amount_cents\` integer not null, \`reason\` text not null, \`created_at\` text not null default current_timestamp, \`updated_at\` text not null default current_timestamp, constraint \`account_fees_tenant_id_foreign\` foreign key (\`tenant_id\`) references \`tenants\` (\`id\`) on delete restrict);`);
    this.addSql(`create index \`account_fees_tenant_id\` on \`account_fees\` (\`tenant_id\`);`);

    this.addSql(`create table \`meters\` (\`id\` text not null primary key, \`building_id\` text not null, \`unit_id\` text null, \`type\` text not null, \`role\` text not null, \`label\` text not null, \`serial_number\` text null, \`measurement_unit\` text not null, \`room\` text null, \`cost_allocation_mode\` text not null default 'cost_types', \`radiator\` text null, \`k_total\` double null, \`radiator_manufacturer\` text null, \`radiator_model\` text null, \`radiator_type\` text null, \`radiator_dimensions\` text null, \`valid_from\` text not null, \`valid_until\` text null, \`is_active\` integer not null default true, \`is_remote_readable\` integer not null default false, \`created_at\` text not null default current_timestamp, \`updated_at\` text not null default current_timestamp, constraint \`meters_building_id_foreign\` foreign key (\`building_id\`) references \`buildings\` (\`id\`) on delete restrict, constraint \`meters_unit_id_foreign\` foreign key (\`unit_id\`) references \`units\` (\`id\`) on delete restrict);`);
    this.addSql(`create index \`meters_building_id_index\` on \`meters\` (\`building_id\`);`);
    this.addSql(`create index \`meters_unit_id_index\` on \`meters\` (\`unit_id\`);`);
    this.addSql(`create unique index \`meters_serial_unique\` on \`meters\` (\`serial_number\`);`);

    this.addSql(`create table \`meter_readings\` (\`id\` text not null primary key, \`meter_id\` text not null, \`reading_date\` text not null, \`value\` double not null, \`is_cumulative\` integer not null default true, \`is_estimated\` integer not null default false, \`read_by\` text not null default 'landlord', \`notes\` text null, \`created_at\` text not null default current_timestamp, \`updated_at\` text not null default current_timestamp, constraint \`meter_readings_meter_id_foreign\` foreign key (\`meter_id\`) references \`meters\` (\`id\`) on delete restrict);`);
    this.addSql(`create index \`meter_readings_meter_id_index\` on \`meter_readings\` (\`meter_id\`);`);
    this.addSql(`create unique index \`meter_readings_meter_date\` on \`meter_readings\` (\`meter_id\`, \`reading_date\`);`);

    this.addSql(`create table \`meter_gas_factors\` (\`id\` text not null primary key, \`meter_id\` text not null, \`valid_from\` text not null, \`valid_until\` text null, \`energy_factor_kwh_per_m3\` double null, \`notes\` text null, \`created_at\` text not null default current_timestamp, \`updated_at\` text not null default current_timestamp, constraint \`meter_gas_factors_meter_id_foreign\` foreign key (\`meter_id\`) references \`meters\` (\`id\`) on delete cascade);`);
    this.addSql(`create index \`meter_gas_factors_meter_id_index\` on \`meter_gas_factors\` (\`meter_id\`);`);
    this.addSql(`create unique index \`meter_gas_factors_meter_from\` on \`meter_gas_factors\` (\`meter_id\`, \`valid_from\`);`);

    this.addSql(`create table \`meter_difference_components\` (\`id\` text not null primary key, \`virtual_meter_id\` text not null, \`source_meter_id\` text not null, \`kind\` text not null, \`created_at\` text not null default current_timestamp, \`updated_at\` text not null default current_timestamp, constraint \`meter_difference_components_virtual_meter_id_foreign\` foreign key (\`virtual_meter_id\`) references \`meters\` (\`id\`) on delete cascade, constraint \`meter_difference_components_source_meter_id_foreign\` foreign key (\`source_meter_id\`) references \`meters\` (\`id\`) on delete restrict);`);
    this.addSql(`create index \`meter_difference_components_virtual_meter_id_index\` on \`meter_difference_components\` (\`virtual_meter_id\`);`);
    this.addSql(`create index \`meter_difference_components_source_meter_id_index\` on \`meter_difference_components\` (\`source_meter_id\`);`);
    this.addSql(`create unique index \`meter_diff_components_unique\` on \`meter_difference_components\` (\`virtual_meter_id\`, \`source_meter_id\`);`);

    this.addSql(`create table \`meter_cost_type_assignments\` (\`meter_id\` text not null, \`cost_type_id\` text not null, \`created_at\` text not null default current_timestamp, primary key (\`meter_id\`, \`cost_type_id\`), constraint \`meter_cost_type_assignments_meter_id_foreign\` foreign key (\`meter_id\`) references \`meters\` (\`id\`) on update cascade on delete cascade, constraint \`meter_cost_type_assignments_cost_type_id_foreign\` foreign key (\`cost_type_id\`) references \`cost_types\` (\`id\`) on update cascade on delete cascade);`);
    this.addSql(`create index \`meter_cost_type_assignments_meter_id_index\` on \`meter_cost_type_assignments\` (\`meter_id\`);`);
    this.addSql(`create index \`meter_cost_type_assignments_cost_type_id_index\` on \`meter_cost_type_assignments\` (\`cost_type_id\`);`);

    this.addSql(`create table \`climate_factors\` (\`id\` text not null primary key, \`postal_code\` text not null, \`period_start\` text not null, \`period_end\` text not null, \`factor\` double not null, \`is_manual\` integer not null default false, \`created_at\` text not null default current_timestamp, \`updated_at\` text not null default current_timestamp);`);
    this.addSql(`create unique index \`climate_factors_postal_code_period\` on \`climate_factors\` (\`postal_code\`, \`period_start\`, \`period_end\`);`);
    this.addSql(`create table \`heating_settings\` (\`id\` text not null primary key, \`building_id\` text not null, \`mode\` text not null, \`base_share_percent\` integer not null default 30, \`consumption_share_percent\` integer not null default 70, \`base_method\` text not null default 'area', \`consumption_method\` text not null default 'heat_meter', \`proration_method\` text not null default 'linear', \`heating_type\` text not null default 'central_without_hot_water', \`fuel_type\` text not null default 'gas', \`hot_water_meter_id\` text null, \`hot_water_supply_temperature_celsius\` integer not null default 60, \`total_heat_energy_kwh\` double null, \`gas_billing_by_calorific_value\` integer not null default false, \`heat_pump_monovalent\` integer not null default false, \`mandatory_seventy_percent\` integer not null default false, \`district_heat_emissions_kg_per_year\` double null, \`district_heat_primary_energy_factor\` double null, \`include_billing_info\` integer not null default true, \`co2_cost_share_enabled\` integer not null default true, \`valid_from\` text not null default '1900-01-01', \`valid_to\` text null, \`created_at\` text not null default current_timestamp, \`updated_at\` text not null default current_timestamp, constraint \`heating_settings_building_id_foreign\` foreign key (\`building_id\`) references \`buildings\` (\`id\`) on delete restrict, constraint \`heating_settings_hot_water_meter_id_foreign\` foreign key (\`hot_water_meter_id\`) references \`meters\` (\`id\`) on delete set null);`);
    this.addSql(`create index \`heating_settings_building_id_index\` on \`heating_settings\` (\`building_id\`);`);
    this.addSql(`create index \`heating_settings_hot_water_meter_id_index\` on \`heating_settings\` (\`hot_water_meter_id\`);`);
    this.addSql(`create unique index \`heating_settings_building_id_valid_from_unique\` on \`heating_settings\` (\`building_id\`, \`valid_from\`);`);

    this.addSql(`create table \`external_heating_entries\` (\`id\` text not null primary key, \`building_id\` text not null, \`unit_id\` text not null, \`period_start\` text not null, \`period_end\` text not null, \`total_cents\` integer not null, \`base_cost_cents\` integer null, \`consumption_cost_cents\` integer null, \`notes\` text null, \`created_at\` text not null default current_timestamp, \`updated_at\` text not null default current_timestamp, constraint \`external_heating_entries_building_id_foreign\` foreign key (\`building_id\`) references \`buildings\` (\`id\`) on delete restrict, constraint \`external_heating_entries_unit_id_foreign\` foreign key (\`unit_id\`) references \`units\` (\`id\`) on delete restrict);`);
    this.addSql(`create index \`external_heating_entries_building_id\` on \`external_heating_entries\` (\`building_id\`);`);
    this.addSql(`create index \`external_heating_entries_unit_id\` on \`external_heating_entries\` (\`unit_id\`);`);

    this.addSql(`create table \`cost_entry_items\` (\`id\` text not null primary key, \`cost_entry_id\` text not null, \`cost_type_id\` text not null, \`unit_id\` text null, \`amount_cents\` integer not null, \`unit_price_cents\` integer null, \`labor_costs_cents\` integer null, \`co2_amount_grams\` integer null, \`co2_cost_cents\` integer null, \`contained_taxes_cents\` integer null, \`contained_tax_kinds\` json null, \`period_start\` text not null, \`period_end\` text not null, \`position\` integer not null default 0, \`created_at\` text not null default current_timestamp, \`updated_at\` text not null default current_timestamp, constraint \`cost_entry_items_cost_entry_id_foreign\` foreign key (\`cost_entry_id\`) references \`cost_entries\` (\`id\`) on delete cascade, constraint \`cost_entry_items_cost_type_id_foreign\` foreign key (\`cost_type_id\`) references \`cost_types\` (\`id\`) on delete restrict, constraint \`cost_entry_items_unit_id_foreign\` foreign key (\`unit_id\`) references \`units\` (\`id\`) on delete restrict);`);
    this.addSql(`create index \`cost_entry_items_cost_entry_id\` on \`cost_entry_items\` (\`cost_entry_id\`);`);
    this.addSql(`create index \`cost_entry_items_cost_type_id\` on \`cost_entry_items\` (\`cost_type_id\`);`);
    this.addSql(`create index \`cost_entry_items_unit_id\` on \`cost_entry_items\` (\`unit_id\`);`);

    this.addSql(`create table \`users\` (\`id\` text not null primary key, \`email\` text not null, \`first_name\` text null, \`last_name\` text null, \`password_hash\` text not null, \`role\` text not null default 'resident', \`resident_id\` text null, \`last_login_at\` text null, \`created_at\` text not null default current_timestamp, \`updated_at\` text not null default current_timestamp, constraint \`users_resident_id_foreign\` foreign key (\`resident_id\`) references \`residents\` (\`id\`) on delete set null);`);
    this.addSql(`create index \`users_resident_id_index\` on \`users\` (\`resident_id\`);`);
    this.addSql(`create unique index \`users_email_unique\` on \`users\` (\`email\`);`);

    this.addSql(`create table \`sessions\` (\`id\` text not null primary key, \`user_id\` text not null, \`expires_at\` text not null, \`created_at\` text not null default current_timestamp, constraint \`sessions_user_id_foreign\` foreign key (\`user_id\`) references \`users\` (\`id\`) on delete cascade);`);
    this.addSql(`create index \`sessions_user_id\` on \`sessions\` (\`user_id\`);`);

    this.addSql(`create table \`operating_cost_statements\` (\`id\` text not null primary key, \`building_id\` text not null, \`tenant_id\` text not null, \`period_start\` text not null, \`period_end\` text not null, \`document_date\` text null, \`status\` text not null default 'draft', \`snapshot_data\` json null, \`total_costs_cents\` integer null, \`total_advances_cents\` integer null, \`balance_cents\` integer null, \`adjusted_monthly_advance_cents\` integer null, \`adjusted_advance_valid_from\` text null, \`tariff_adjustment_bps\` json null, \`finalized_at\` text null, \`finalized_by_user_id\` text null, \`pdf_path\` text null, \`sequence_number\` integer null, \`revision_number\` integer null, \`sent_at\` text null, \`supersedes_statement_id\` text null, \`cancelled_at\` text null, \`cancelled_by_user_id\` text null, \`cancellation_reason\` text null, \`notes\` text null, \`created_at\` text not null default current_timestamp, \`updated_at\` text not null default current_timestamp, constraint \`operating_cost_statements_building_id_foreign\` foreign key (\`building_id\`) references \`buildings\` (\`id\`) on delete restrict, constraint \`operating_cost_statements_tenant_id_foreign\` foreign key (\`tenant_id\`) references \`tenants\` (\`id\`) on delete restrict, constraint \`operating_cost_statements_finalized_by_user_id_foreign\` foreign key (\`finalized_by_user_id\`) references \`users\` (\`id\`) on delete set null, constraint \`operating_cost_statements_cancelled_by_user_id_foreign\` foreign key (\`cancelled_by_user_id\`) references \`users\` (\`id\`) on delete set null);`);
    this.addSql(`create index \`operating_cost_statements_finalized_by_user_id_index\` on \`operating_cost_statements\` (\`finalized_by_user_id\`);`);
    this.addSql(`create index \`operating_cost_statements_cancelled_by_user_id_index\` on \`operating_cost_statements\` (\`cancelled_by_user_id\`);`);
    this.addSql(`create index \`operating_cost_statements_tenant_id\` on \`operating_cost_statements\` (\`tenant_id\`);`);
    this.addSql(`create index \`operating_cost_statements_building_id\` on \`operating_cost_statements\` (\`building_id\`);`);

    this.addSql(`create table \`account_settlements\` (\`id\` text not null primary key, \`tenant_id\` text not null, \`statement_id\` text not null, \`date\` text not null, \`amount_cents\` integer not null, \`created_at\` text not null default current_timestamp, constraint \`account_settlements_tenant_id_foreign\` foreign key (\`tenant_id\`) references \`tenants\` (\`id\`) on delete restrict, constraint \`account_settlements_statement_id_foreign\` foreign key (\`statement_id\`) references \`operating_cost_statements\` (\`id\`) on delete restrict);`);
    this.addSql(`create index \`account_settlements_tenant_id\` on \`account_settlements\` (\`tenant_id\`);`);
    this.addSql(`create index \`account_settlements_statement_id\` on \`account_settlements\` (\`statement_id\`);`);
    this.addSql(`create unique index \`account_settlements_statement_id_unique\` on \`account_settlements\` (\`statement_id\`);`);
  }

  override down(): void | Promise<void> {

    this.addSql(`drop table if exists \`app_settings\`;`);
    this.addSql(`drop table if exists \`buildings\`;`);
    this.addSql(`drop table if exists \`cost_entries\`;`);
    this.addSql(`drop table if exists \`cost_entry_attachments\`;`);
    this.addSql(`drop table if exists \`cost_types\`;`);
    this.addSql(`drop table if exists \`residents\`;`);
    this.addSql(`drop table if exists \`units\`;`);
    this.addSql(`drop table if exists \`tenants\`;`);
    this.addSql(`drop table if exists \`tenant_residents\`;`);
    this.addSql(`drop table if exists \`tenant_rents\`;`);
    this.addSql(`drop table if exists \`tenant_bank_accounts\`;`);
    this.addSql(`drop table if exists \`tenant_addresses\`;`);
    this.addSql(`drop table if exists \`payments\`;`);
    this.addSql(`drop table if exists \`account_fees\`;`);
    this.addSql(`drop table if exists \`meters\`;`);
    this.addSql(`drop table if exists \`meter_readings\`;`);
    this.addSql(`drop table if exists \`meter_gas_factors\`;`);
    this.addSql(`drop table if exists \`meter_difference_components\`;`);
    this.addSql(`drop table if exists \`meter_cost_type_assignments\`;`);
    this.addSql(`drop table if exists \`heating_settings\`;`);
    this.addSql(`drop table if exists \`external_heating_entries\`;`);
    this.addSql(`drop table if exists \`cost_entry_items\`;`);
    this.addSql(`drop table if exists \`users\`;`);
    this.addSql(`drop table if exists \`sessions\`;`);
    this.addSql(`drop table if exists \`operating_cost_statements\`;`);
    this.addSql(`drop table if exists \`account_settlements\`;`);
    this.addSql(`drop table if exists \`climate_factors\`;`);
  }

}
