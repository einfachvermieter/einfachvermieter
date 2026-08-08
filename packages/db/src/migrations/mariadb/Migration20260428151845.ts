import { Migration } from '@mikro-orm/migrations';

export class Migration20260428151845 extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table \`app_settings\` (\`id\` varchar(255) not null default 'default', \`sender_name\` varchar(255) not null default '', \`sender_address_street\` varchar(255) not null default '', \`sender_address_postal_code\` varchar(255) not null default '', \`sender_address_city\` varchar(255) not null default '', \`sender_phone\` varchar(255) null, \`sender_fax\` varchar(255) null, \`sender_email\` varchar(255) null, \`sender_bank_name\` varchar(255) null, \`sender_bank_iban\` varchar(255) null, \`sender_bank_bic\` varchar(255) null, \`use_logo\` tinyint(1) not null default true, \`logo_storage_key\` text null, \`logo_mime_type\` varchar(255) null, \`created_at\` varchar(255) not null default current_timestamp, \`updated_at\` varchar(255) not null default current_timestamp, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);

    this.addSql(`create table \`buildings\` (\`id\` varchar(255) not null, \`name\` varchar(255) not null, \`address_street\` varchar(255) not null, \`address_postal_code\` varchar(255) not null, \`address_city\` varchar(255) not null, \`created_at\` varchar(255) not null default current_timestamp, \`updated_at\` varchar(255) not null default current_timestamp, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`buildings\` add unique \`buildings_name_unique\` (\`name\`);`);

    this.addSql(`create table \`cost_entries\` (\`id\` varchar(255) not null, \`invoice_date\` varchar(255) not null, \`invoice_number\` varchar(255) null, \`vendor\` varchar(255) null, \`document_path\` text null, \`notes\` text null, \`created_at\` varchar(255) not null default current_timestamp, \`updated_at\` varchar(255) not null default current_timestamp, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);

    this.addSql(`create table \`cost_entry_attachments\` (\`id\` varchar(255) not null, \`cost_entry_id\` varchar(255) not null, \`original_filename\` varchar(255) not null, \`mime_type\` varchar(255) not null, \`size_bytes\` int not null, \`storage_key\` text not null, \`ocr_text\` text null, \`created_at\` varchar(255) not null default current_timestamp, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`cost_entry_attachments\` add index \`cost_entry_attachments_cost_entry_id\` (\`cost_entry_id\`);`);

    this.addSql(`create table \`cost_types\` (\`id\` varchar(255) not null, \`building_id\` varchar(255) not null, \`name\` varchar(255) not null, \`category\` varchar(255) not null default 'operating', \`default_allocation_key\` varchar(255) null, \`labor_cost_category\` varchar(255) null, \`co2_tracked\` tinyint(1) not null default false, \`is_metering_service_cost\` tinyint(1) not null default false, \`description\` text null, \`created_at\` varchar(255) not null default current_timestamp, \`updated_at\` varchar(255) not null default current_timestamp, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`cost_types\` add index \`cost_types_building_id\` (\`building_id\`);`);

    this.addSql(`create table \`residents\` (\`id\` varchar(255) not null, \`first_name\` varchar(255) not null, \`last_name\` varchar(255) not null, \`email\` varchar(255) null, \`phone\` varchar(255) null, \`created_at\` varchar(255) not null default current_timestamp, \`updated_at\` varchar(255) not null default current_timestamp, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);

    this.addSql(`create table \`units\` (\`id\` varchar(255) not null, \`building_id\` varchar(255) not null, \`name\` varchar(255) not null, \`unit_number\` varchar(255) null, \`area_sqm\` double not null, \`heating_area_sqm\` double null, \`created_at\` varchar(255) not null default current_timestamp, \`updated_at\` varchar(255) not null default current_timestamp, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`units\` add index \`units_building_id_index\` (\`building_id\`);`);
    this.addSql(`alter table \`units\` add unique \`units_building_name_unique\` (\`building_id\`, \`name\`);`);

    this.addSql(`create table \`tenants\` (\`id\` varchar(255) not null, \`unit_id\` varchar(255) not null, \`kind\` varchar(255) not null default 'private', \`start_date\` varchar(255) not null, \`end_date\` varchar(255) null, \`deposit_cents\` int not null default 0, \`notes\` text null, \`created_at\` varchar(255) not null default current_timestamp, \`updated_at\` varchar(255) not null default current_timestamp, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`tenants\` add index \`tenants_unit_id\` (\`unit_id\`);`);

    this.addSql(`create table \`tenant_residents\` (\`id\` varchar(255) not null, \`tenant_id\` varchar(255) not null, \`resident_id\` varchar(255) not null, \`move_in_date\` varchar(255) null, \`move_out_date\` varchar(255) null, \`is_contract_party\` int not null default 1, \`created_at\` varchar(255) not null default current_timestamp, \`updated_at\` varchar(255) not null default current_timestamp, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`tenant_residents\` add index \`tenant_residents_tenant_id_index\` (\`tenant_id\`);`);
    this.addSql(`alter table \`tenant_residents\` add index \`tenant_residents_resident_id_index\` (\`resident_id\`);`);
    this.addSql(`alter table \`tenant_residents\` add unique \`tenant_residents_tenant_resident_unique\` (\`tenant_id\`, \`resident_id\`);`);

    this.addSql(`create table \`tenant_rents\` (\`id\` varchar(255) not null, \`tenant_id\` varchar(255) not null, \`start_date\` varchar(255) null, \`end_date\` varchar(255) null, \`monthly_base_rent_cents\` int not null, \`monthly_advance_cents\` int not null, \`reduction_reason\` text null, \`created_at\` varchar(255) not null default current_timestamp, \`updated_at\` varchar(255) not null default current_timestamp, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`tenant_rents\` add index \`tenant_rents_tenant_id\` (\`tenant_id\`);`);

    this.addSql(`create table \`tenant_bank_accounts\` (\`id\` varchar(255) not null, \`tenant_id\` varchar(255) not null, \`start_date\` varchar(255) null, \`end_date\` varchar(255) null, \`iban\` varchar(255) not null, \`bic\` varchar(255) null, \`account_holder\` varchar(255) not null, \`mandate_reference\` varchar(255) null, \`mandate_signed_at\` varchar(255) null, \`created_at\` varchar(255) not null default current_timestamp, \`updated_at\` varchar(255) not null default current_timestamp, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`tenant_bank_accounts\` add index \`tenant_bank_accounts_tenant_id\` (\`tenant_id\`);`);

    this.addSql(`create table \`tenant_addresses\` (\`id\` varchar(255) not null, \`tenant_id\` varchar(255) not null, \`start_date\` varchar(255) null, \`end_date\` varchar(255) null, \`street\` varchar(255) not null, \`postal_code\` varchar(255) not null, \`city\` varchar(255) not null, \`created_at\` varchar(255) not null default current_timestamp, \`updated_at\` varchar(255) not null default current_timestamp, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`tenant_addresses\` add index \`tenant_addresses_tenant_id\` (\`tenant_id\`);`);

    this.addSql(`create table \`payments\` (\`id\` varchar(255) not null, \`tenant_id\` varchar(255) not null, \`payment_date\` varchar(255) not null, \`reference\` varchar(255) null, \`for_month\` varchar(255) null, \`for_statement_id\` varchar(255) null, \`for_deposit\` tinyint(1) not null default false, \`for_fee_id\` varchar(255) null, \`base_rent_cents\` int null, \`advance_cents\` int null, \`amount_cents\` int null, \`created_at\` varchar(255) not null default current_timestamp, \`updated_at\` varchar(255) not null default current_timestamp, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`payments\` add index \`payments_tenant_id\` (\`tenant_id\`);`);

    this.addSql(`create table \`account_fees\` (\`id\` varchar(255) not null, \`tenant_id\` varchar(255) not null, \`date\` varchar(255) not null, \`amount_cents\` int not null, \`reason\` text not null, \`created_at\` varchar(255) not null default current_timestamp, \`updated_at\` varchar(255) not null default current_timestamp, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`account_fees\` add index \`account_fees_tenant_id\` (\`tenant_id\`);`);

    this.addSql(`create table \`meters\` (\`id\` varchar(255) not null, \`building_id\` varchar(255) not null, \`unit_id\` varchar(255) null, \`type\` varchar(255) not null, \`role\` varchar(255) not null, \`label\` varchar(255) not null, \`serial_number\` varchar(255) null, \`measurement_unit\` varchar(255) not null, \`room\` varchar(255) null, \`cost_allocation_mode\` varchar(255) not null default 'cost_types', \`radiator\` varchar(255) null, \`k_total\` double null, \`radiator_manufacturer\` varchar(255) null, \`radiator_model\` varchar(255) null, \`radiator_type\` varchar(255) null, \`radiator_dimensions\` varchar(255) null, \`valid_from\` varchar(255) not null, \`valid_until\` varchar(255) null, \`is_active\` tinyint(1) not null default true, \`is_remote_readable\` tinyint(1) not null default false, \`created_at\` varchar(255) not null default current_timestamp, \`updated_at\` varchar(255) not null default current_timestamp, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`meters\` add index \`meters_building_id_index\` (\`building_id\`);`);
    this.addSql(`alter table \`meters\` add index \`meters_unit_id_index\` (\`unit_id\`);`);
    this.addSql(`alter table \`meters\` add unique \`meters_serial_unique\` (\`serial_number\`);`);

    this.addSql(`create table \`meter_readings\` (\`id\` varchar(255) not null, \`meter_id\` varchar(255) not null, \`reading_date\` varchar(255) not null, \`value\` double not null, \`is_cumulative\` tinyint(1) not null default true, \`is_estimated\` tinyint(1) not null default false, \`read_by\` varchar(255) not null default 'landlord', \`notes\` text null, \`created_at\` varchar(255) not null default current_timestamp, \`updated_at\` varchar(255) not null default current_timestamp, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`meter_readings\` add index \`meter_readings_meter_id_index\` (\`meter_id\`);`);
    this.addSql(`alter table \`meter_readings\` add unique \`meter_readings_meter_date\` (\`meter_id\`, \`reading_date\`);`);

    this.addSql(`create table \`meter_gas_factors\` (\`id\` varchar(255) not null, \`meter_id\` varchar(255) not null, \`valid_from\` varchar(255) not null, \`valid_until\` varchar(255) null, \`energy_factor_kwh_per_m3\` double null, \`notes\` text null, \`created_at\` varchar(255) not null default current_timestamp, \`updated_at\` varchar(255) not null default current_timestamp, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`meter_gas_factors\` add index \`meter_gas_factors_meter_id_index\` (\`meter_id\`);`);
    this.addSql(`alter table \`meter_gas_factors\` add unique \`meter_gas_factors_meter_from\` (\`meter_id\`, \`valid_from\`);`);

    this.addSql(`create table \`meter_difference_components\` (\`id\` varchar(255) not null, \`virtual_meter_id\` varchar(255) not null, \`source_meter_id\` varchar(255) not null, \`kind\` varchar(255) not null, \`created_at\` varchar(255) not null default current_timestamp, \`updated_at\` varchar(255) not null default current_timestamp, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`meter_difference_components\` add index \`meter_difference_components_virtual_meter_id_index\` (\`virtual_meter_id\`);`);
    this.addSql(`alter table \`meter_difference_components\` add index \`meter_difference_components_source_meter_id_index\` (\`source_meter_id\`);`);
    this.addSql(`alter table \`meter_difference_components\` add unique \`meter_diff_components_unique\` (\`virtual_meter_id\`, \`source_meter_id\`);`);

    this.addSql(`create table \`meter_cost_type_assignments\` (\`meter_id\` varchar(255) not null, \`cost_type_id\` varchar(255) not null, \`created_at\` varchar(255) not null default current_timestamp, primary key (\`meter_id\`, \`cost_type_id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`meter_cost_type_assignments\` add index \`meter_cost_type_assignments_meter_id_index\` (\`meter_id\`);`);
    this.addSql(`alter table \`meter_cost_type_assignments\` add index \`meter_cost_type_assignments_cost_type_id_index\` (\`cost_type_id\`);`);

    this.addSql(`create table \`heating_settings\` (\`id\` varchar(255) not null, \`building_id\` varchar(255) not null, \`mode\` varchar(255) not null, \`base_share_percent\` int not null default 30, \`consumption_share_percent\` int not null default 70, \`base_method\` varchar(255) not null default 'area', \`consumption_method\` varchar(255) not null default 'heat_meter', \`proration_method\` varchar(255) not null default 'linear', \`heating_type\` varchar(255) not null default 'central_without_hot_water', \`fuel_type\` varchar(255) not null default 'gas', \`hot_water_meter_id\` varchar(255) null, \`hot_water_supply_temperature_celsius\` int not null default 60, \`total_heat_energy_kwh\` double null, \`gas_billing_by_calorific_value\` tinyint(1) not null default false, \`heat_pump_monovalent\` tinyint(1) not null default false, \`mandatory_seventy_percent\` tinyint(1) not null default false, \`district_heat_emissions_kg_per_year\` double null, \`district_heat_primary_energy_factor\` double null, \`include_billing_info\` tinyint(1) not null default true, \`co2_cost_share_enabled\` tinyint(1) not null default true, \`valid_from\` varchar(255) not null default '1900-01-01', \`valid_to\` varchar(255) null, \`created_at\` varchar(255) not null default current_timestamp, \`updated_at\` varchar(255) not null default current_timestamp, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`heating_settings\` add index \`heating_settings_building_id_index\` (\`building_id\`);`);
    this.addSql(`alter table \`heating_settings\` add index \`heating_settings_hot_water_meter_id_index\` (\`hot_water_meter_id\`);`);
    this.addSql(`alter table \`heating_settings\` add unique \`heating_settings_building_id_valid_from_unique\` (\`building_id\`, \`valid_from\`);`);

    this.addSql(`create table \`external_heating_entries\` (\`id\` varchar(255) not null, \`building_id\` varchar(255) not null, \`unit_id\` varchar(255) not null, \`period_start\` varchar(255) not null, \`period_end\` varchar(255) not null, \`total_cents\` int not null, \`base_cost_cents\` int null, \`consumption_cost_cents\` int null, \`notes\` text null, \`created_at\` varchar(255) not null default current_timestamp, \`updated_at\` varchar(255) not null default current_timestamp, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`external_heating_entries\` add index \`external_heating_entries_building_id\` (\`building_id\`);`);
    this.addSql(`alter table \`external_heating_entries\` add index \`external_heating_entries_unit_id\` (\`unit_id\`);`);

    this.addSql(`create table \`cost_entry_items\` (\`id\` varchar(255) not null, \`cost_entry_id\` varchar(255) not null, \`cost_type_id\` varchar(255) not null, \`unit_id\` varchar(255) null, \`amount_cents\` int not null, \`unit_price_cents\` int null, \`labor_costs_cents\` int null, \`co2_amount_grams\` int null, \`co2_cost_cents\` int null, \`contained_taxes_cents\` int null, \`period_start\` varchar(255) not null, \`period_end\` varchar(255) not null, \`position\` int not null default 0, \`created_at\` varchar(255) not null default current_timestamp, \`updated_at\` varchar(255) not null default current_timestamp, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`cost_entry_items\` add index \`cost_entry_items_cost_entry_id\` (\`cost_entry_id\`);`);
    this.addSql(`alter table \`cost_entry_items\` add index \`cost_entry_items_cost_type_id\` (\`cost_type_id\`);`);
    this.addSql(`alter table \`cost_entry_items\` add index \`cost_entry_items_unit_id\` (\`unit_id\`);`);

    this.addSql(`create table \`users\` (\`id\` varchar(255) not null, \`email\` varchar(255) not null, \`first_name\` varchar(255) null, \`last_name\` varchar(255) null, \`password_hash\` varchar(255) not null, \`role\` varchar(255) not null default 'resident', \`resident_id\` varchar(255) null, \`last_login_at\` varchar(255) null, \`created_at\` varchar(255) not null default current_timestamp, \`updated_at\` varchar(255) not null default current_timestamp, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`users\` add index \`users_resident_id_index\` (\`resident_id\`);`);
    this.addSql(`alter table \`users\` add unique \`users_email_unique\` (\`email\`);`);

    this.addSql(`create table \`sessions\` (\`id\` varchar(255) not null, \`user_id\` varchar(255) not null, \`expires_at\` varchar(255) not null, \`created_at\` varchar(255) not null default current_timestamp, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`sessions\` add index \`sessions_user_id\` (\`user_id\`);`);

    this.addSql(`create table \`operating_cost_statements\` (\`id\` varchar(255) not null, \`building_id\` varchar(255) not null, \`tenant_id\` varchar(255) not null, \`period_start\` varchar(255) not null, \`period_end\` varchar(255) not null, \`document_date\` varchar(255) null, \`status\` varchar(255) not null default 'draft', \`snapshot_data\` json null, \`total_costs_cents\` int null, \`total_advances_cents\` int null, \`balance_cents\` int null, \`adjusted_monthly_advance_cents\` int null, \`adjusted_advance_valid_from\` varchar(255) null, \`tariff_adjustment_bps\` json null, \`finalized_at\` varchar(255) null, \`finalized_by_user_id\` varchar(255) null, \`pdf_path\` text null, \`sequence_number\` int null, \`revision_number\` int null, \`sent_at\` varchar(255) null, \`supersedes_statement_id\` varchar(255) null, \`cancelled_at\` varchar(255) null, \`cancelled_by_user_id\` varchar(255) null, \`cancellation_reason\` text null, \`notes\` text null, \`created_at\` varchar(255) not null default current_timestamp, \`updated_at\` varchar(255) not null default current_timestamp, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`operating_cost_statements\` add index \`operating_cost_statements_finalized_by_user_id_index\` (\`finalized_by_user_id\`);`);
    this.addSql(`alter table \`operating_cost_statements\` add index \`operating_cost_statements_cancelled_by_user_id_index\` (\`cancelled_by_user_id\`);`);
    this.addSql(`alter table \`operating_cost_statements\` add index \`operating_cost_statements_tenant_id\` (\`tenant_id\`);`);
    this.addSql(`alter table \`operating_cost_statements\` add index \`operating_cost_statements_building_id\` (\`building_id\`);`);

    this.addSql(`create table \`account_settlements\` (\`id\` varchar(255) not null, \`tenant_id\` varchar(255) not null, \`statement_id\` varchar(255) not null, \`date\` varchar(255) not null, \`amount_cents\` int not null, \`created_at\` varchar(255) not null default current_timestamp, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`account_settlements\` add index \`account_settlements_tenant_id\` (\`tenant_id\`);`);
    this.addSql(`alter table \`account_settlements\` add index \`account_settlements_statement_id\` (\`statement_id\`);`);
    this.addSql(`alter table \`account_settlements\` add unique \`account_settlements_statement_id_unique\` (\`statement_id\`);`);

    this.addSql(`alter table \`cost_entry_attachments\` add constraint \`cost_entry_attachments_cost_entry_id_foreign\` foreign key (\`cost_entry_id\`) references \`cost_entries\` (\`id\`) on delete cascade;`);

    this.addSql(`alter table \`cost_types\` add constraint \`cost_types_building_id_foreign\` foreign key (\`building_id\`) references \`buildings\` (\`id\`) on delete restrict;`);

    this.addSql(`alter table \`units\` add constraint \`units_building_id_foreign\` foreign key (\`building_id\`) references \`buildings\` (\`id\`) on delete restrict;`);

    this.addSql(`alter table \`tenants\` add constraint \`tenants_unit_id_foreign\` foreign key (\`unit_id\`) references \`units\` (\`id\`) on delete restrict;`);

    this.addSql(`alter table \`tenant_residents\` add constraint \`tenant_residents_tenant_id_foreign\` foreign key (\`tenant_id\`) references \`tenants\` (\`id\`) on delete cascade;`);
    this.addSql(`alter table \`tenant_residents\` add constraint \`tenant_residents_resident_id_foreign\` foreign key (\`resident_id\`) references \`residents\` (\`id\`) on delete restrict;`);

    this.addSql(`alter table \`tenant_rents\` add constraint \`tenant_rents_tenant_id_foreign\` foreign key (\`tenant_id\`) references \`tenants\` (\`id\`) on delete cascade;`);

    this.addSql(`alter table \`tenant_bank_accounts\` add constraint \`tenant_bank_accounts_tenant_id_foreign\` foreign key (\`tenant_id\`) references \`tenants\` (\`id\`) on delete cascade;`);

    this.addSql(`alter table \`tenant_addresses\` add constraint \`tenant_addresses_tenant_id_foreign\` foreign key (\`tenant_id\`) references \`tenants\` (\`id\`) on delete cascade;`);

    this.addSql(`alter table \`payments\` add constraint \`payments_tenant_id_foreign\` foreign key (\`tenant_id\`) references \`tenants\` (\`id\`) on delete restrict;`);

    this.addSql(`alter table \`account_fees\` add constraint \`account_fees_tenant_id_foreign\` foreign key (\`tenant_id\`) references \`tenants\` (\`id\`) on delete restrict;`);

    this.addSql(`alter table \`meters\` add constraint \`meters_building_id_foreign\` foreign key (\`building_id\`) references \`buildings\` (\`id\`) on delete restrict;`);
    this.addSql(`alter table \`meters\` add constraint \`meters_unit_id_foreign\` foreign key (\`unit_id\`) references \`units\` (\`id\`) on delete restrict;`);

    this.addSql(`alter table \`meter_readings\` add constraint \`meter_readings_meter_id_foreign\` foreign key (\`meter_id\`) references \`meters\` (\`id\`) on delete restrict;`);

    this.addSql(`alter table \`meter_gas_factors\` add constraint \`meter_gas_factors_meter_id_foreign\` foreign key (\`meter_id\`) references \`meters\` (\`id\`) on delete cascade;`);

    this.addSql(`alter table \`meter_difference_components\` add constraint \`meter_difference_components_virtual_meter_id_foreign\` foreign key (\`virtual_meter_id\`) references \`meters\` (\`id\`) on delete cascade;`);
    this.addSql(`alter table \`meter_difference_components\` add constraint \`meter_difference_components_source_meter_id_foreign\` foreign key (\`source_meter_id\`) references \`meters\` (\`id\`) on delete restrict;`);

    this.addSql(`alter table \`meter_cost_type_assignments\` add constraint \`meter_cost_type_assignments_meter_id_foreign\` foreign key (\`meter_id\`) references \`meters\` (\`id\`) on update cascade on delete cascade;`);
    this.addSql(`alter table \`meter_cost_type_assignments\` add constraint \`meter_cost_type_assignments_cost_type_id_foreign\` foreign key (\`cost_type_id\`) references \`cost_types\` (\`id\`) on update cascade on delete cascade;`);

    this.addSql(`alter table \`heating_settings\` add constraint \`heating_settings_building_id_foreign\` foreign key (\`building_id\`) references \`buildings\` (\`id\`) on delete restrict;`);
    this.addSql(`alter table \`heating_settings\` add constraint \`heating_settings_hot_water_meter_id_foreign\` foreign key (\`hot_water_meter_id\`) references \`meters\` (\`id\`) on delete set null;`);

    this.addSql(`alter table \`external_heating_entries\` add constraint \`external_heating_entries_building_id_foreign\` foreign key (\`building_id\`) references \`buildings\` (\`id\`) on delete restrict;`);
    this.addSql(`alter table \`external_heating_entries\` add constraint \`external_heating_entries_unit_id_foreign\` foreign key (\`unit_id\`) references \`units\` (\`id\`) on delete restrict;`);

    this.addSql(`alter table \`cost_entry_items\` add constraint \`cost_entry_items_cost_entry_id_foreign\` foreign key (\`cost_entry_id\`) references \`cost_entries\` (\`id\`) on delete cascade;`);
    this.addSql(`alter table \`cost_entry_items\` add constraint \`cost_entry_items_cost_type_id_foreign\` foreign key (\`cost_type_id\`) references \`cost_types\` (\`id\`) on delete restrict;`);
    this.addSql(`alter table \`cost_entry_items\` add constraint \`cost_entry_items_unit_id_foreign\` foreign key (\`unit_id\`) references \`units\` (\`id\`) on delete restrict;`);

    this.addSql(`alter table \`users\` add constraint \`users_resident_id_foreign\` foreign key (\`resident_id\`) references \`residents\` (\`id\`) on delete set null;`);

    this.addSql(`alter table \`sessions\` add constraint \`sessions_user_id_foreign\` foreign key (\`user_id\`) references \`users\` (\`id\`) on delete cascade;`);

    this.addSql(`alter table \`operating_cost_statements\` add constraint \`operating_cost_statements_building_id_foreign\` foreign key (\`building_id\`) references \`buildings\` (\`id\`) on delete restrict;`);
    this.addSql(`alter table \`operating_cost_statements\` add constraint \`operating_cost_statements_tenant_id_foreign\` foreign key (\`tenant_id\`) references \`tenants\` (\`id\`) on delete restrict;`);
    this.addSql(`alter table \`operating_cost_statements\` add constraint \`operating_cost_statements_finalized_by_user_id_foreign\` foreign key (\`finalized_by_user_id\`) references \`users\` (\`id\`) on delete set null;`);
    this.addSql(`alter table \`operating_cost_statements\` add constraint \`operating_cost_statements_cancelled_by_user_id_foreign\` foreign key (\`cancelled_by_user_id\`) references \`users\` (\`id\`) on delete set null;`);

    this.addSql(`alter table \`account_settlements\` add constraint \`account_settlements_tenant_id_foreign\` foreign key (\`tenant_id\`) references \`tenants\` (\`id\`) on delete restrict;`);
    this.addSql(`alter table \`account_settlements\` add constraint \`account_settlements_statement_id_foreign\` foreign key (\`statement_id\`) references \`operating_cost_statements\` (\`id\`) on delete restrict;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`cost_types\` drop foreign key \`cost_types_building_id_foreign\`;`);
    this.addSql(`alter table \`units\` drop foreign key \`units_building_id_foreign\`;`);
    this.addSql(`alter table \`meters\` drop foreign key \`meters_building_id_foreign\`;`);
    this.addSql(`alter table \`heating_settings\` drop foreign key \`heating_settings_building_id_foreign\`;`);
    this.addSql(`alter table \`external_heating_entries\` drop foreign key \`external_heating_entries_building_id_foreign\`;`);
    this.addSql(`alter table \`operating_cost_statements\` drop foreign key \`operating_cost_statements_building_id_foreign\`;`);
    this.addSql(`alter table \`cost_entry_attachments\` drop foreign key \`cost_entry_attachments_cost_entry_id_foreign\`;`);
    this.addSql(`alter table \`cost_entry_items\` drop foreign key \`cost_entry_items_cost_entry_id_foreign\`;`);
    this.addSql(`alter table \`meter_cost_type_assignments\` drop foreign key \`meter_cost_type_assignments_cost_type_id_foreign\`;`);
    this.addSql(`alter table \`cost_entry_items\` drop foreign key \`cost_entry_items_cost_type_id_foreign\`;`);
    this.addSql(`alter table \`tenant_residents\` drop foreign key \`tenant_residents_resident_id_foreign\`;`);
    this.addSql(`alter table \`users\` drop foreign key \`users_resident_id_foreign\`;`);
    this.addSql(`alter table \`tenants\` drop foreign key \`tenants_unit_id_foreign\`;`);
    this.addSql(`alter table \`meters\` drop foreign key \`meters_unit_id_foreign\`;`);
    this.addSql(`alter table \`external_heating_entries\` drop foreign key \`external_heating_entries_unit_id_foreign\`;`);
    this.addSql(`alter table \`cost_entry_items\` drop foreign key \`cost_entry_items_unit_id_foreign\`;`);
    this.addSql(`alter table \`tenant_residents\` drop foreign key \`tenant_residents_tenant_id_foreign\`;`);
    this.addSql(`alter table \`tenant_rents\` drop foreign key \`tenant_rents_tenant_id_foreign\`;`);
    this.addSql(`alter table \`tenant_bank_accounts\` drop foreign key \`tenant_bank_accounts_tenant_id_foreign\`;`);
    this.addSql(`alter table \`tenant_addresses\` drop foreign key \`tenant_addresses_tenant_id_foreign\`;`);
    this.addSql(`alter table \`payments\` drop foreign key \`payments_tenant_id_foreign\`;`);
    this.addSql(`alter table \`account_fees\` drop foreign key \`account_fees_tenant_id_foreign\`;`);
    this.addSql(`alter table \`operating_cost_statements\` drop foreign key \`operating_cost_statements_tenant_id_foreign\`;`);
    this.addSql(`alter table \`account_settlements\` drop foreign key \`account_settlements_tenant_id_foreign\`;`);
    this.addSql(`alter table \`meter_readings\` drop foreign key \`meter_readings_meter_id_foreign\`;`);
    this.addSql(`alter table \`meter_gas_factors\` drop foreign key \`meter_gas_factors_meter_id_foreign\`;`);
    this.addSql(`alter table \`meter_difference_components\` drop foreign key \`meter_difference_components_virtual_meter_id_foreign\`;`);
    this.addSql(`alter table \`meter_difference_components\` drop foreign key \`meter_difference_components_source_meter_id_foreign\`;`);
    this.addSql(`alter table \`meter_cost_type_assignments\` drop foreign key \`meter_cost_type_assignments_meter_id_foreign\`;`);
    this.addSql(`alter table \`heating_settings\` drop foreign key \`heating_settings_hot_water_meter_id_foreign\`;`);
    this.addSql(`alter table \`sessions\` drop foreign key \`sessions_user_id_foreign\`;`);
    this.addSql(`alter table \`operating_cost_statements\` drop foreign key \`operating_cost_statements_finalized_by_user_id_foreign\`;`);
    this.addSql(`alter table \`operating_cost_statements\` drop foreign key \`operating_cost_statements_cancelled_by_user_id_foreign\`;`);
    this.addSql(`alter table \`account_settlements\` drop foreign key \`account_settlements_statement_id_foreign\`;`);

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
  }

}
