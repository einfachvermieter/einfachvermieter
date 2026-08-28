import { Migration } from '@mikro-orm/migrations';

export class Migration20260428151834 extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table "app_settings" ("id" varchar(255) not null default 'default', "sender_name" varchar(255) not null default '', "sender_address_street" varchar(255) not null default '', "sender_address_postal_code" varchar(255) not null default '', "sender_address_city" varchar(255) not null default '', "sender_phone" varchar(255) null, "sender_fax" varchar(255) null, "sender_email" varchar(255) null, "sender_bank_name" varchar(255) null, "sender_bank_iban" varchar(255) null, "sender_bank_bic" varchar(255) null, "use_logo" boolean not null default true, "logo_storage_key" text null, "logo_mime_type" varchar(255) null, "ai_provider" varchar(255) null, "ai_api_key" text null, "ai_base_url" text null, "ai_model" varchar(255) null, "climate_factors_auto_fetch" boolean null, "update_check_enabled" boolean null, "telemetry_enabled" boolean null, "installation_id" varchar(255) null, "telemetry_last_sent_at" varchar(255) null, "last_app_version" varchar(255) null, "created_at" varchar(255) not null default current_timestamp, "updated_at" varchar(255) not null default current_timestamp, primary key ("id"));`);

    this.addSql(`create table "buildings" ("id" varchar(255) not null, "name" varchar(255) not null, "address_street" varchar(255) not null, "address_postal_code" varchar(255) not null, "address_city" varchar(255) not null, "created_at" varchar(255) not null default current_timestamp, "updated_at" varchar(255) not null default current_timestamp, primary key ("id"));`);
    this.addSql(`alter table "buildings" add constraint "buildings_name_unique" unique ("name");`);

    this.addSql(`create table "cost_entries" ("id" varchar(255) not null, "building_id" varchar(255) not null, "invoice_date" varchar(255) not null, "invoice_number" varchar(255) null, "vendor" varchar(255) null, "document_path" text null, "notes" text null, "created_at" varchar(255) not null default current_timestamp, "updated_at" varchar(255) not null default current_timestamp, primary key ("id"));`);
    this.addSql(`create index "cost_entries_building_id" on "cost_entries" ("building_id");`);

    this.addSql(`create table "cost_entry_attachments" ("id" varchar(255) not null, "cost_entry_id" varchar(255) not null, "original_filename" varchar(255) not null, "mime_type" varchar(255) not null, "size_bytes" int not null, "storage_key" text not null, "ocr_text" text null, "created_at" varchar(255) not null default current_timestamp, primary key ("id"));`);
    this.addSql(`create index "cost_entry_attachments_cost_entry_id" on "cost_entry_attachments" ("cost_entry_id");`);

    this.addSql(`create table "cost_types" ("id" varchar(255) not null, "building_id" varchar(255) not null, "name" varchar(255) not null, "category" varchar(255) not null default 'operating', "default_allocation_key" varchar(255) null, "labor_cost_category" varchar(255) null, "co2_tracked" boolean not null default false, "is_metering_service_cost" boolean not null default false, "description" text null, "created_at" varchar(255) not null default current_timestamp, "updated_at" varchar(255) not null default current_timestamp, primary key ("id"));`);
    this.addSql(`create index "cost_types_building_id" on "cost_types" ("building_id");`);

    this.addSql(`create table "residents" ("id" varchar(255) not null, "first_name" varchar(255) not null, "last_name" varchar(255) not null, "email" varchar(255) null, "phone" varchar(255) null, "created_at" varchar(255) not null default current_timestamp, "updated_at" varchar(255) not null default current_timestamp, primary key ("id"));`);

    this.addSql(`create table "units" ("id" varchar(255) not null, "building_id" varchar(255) not null, "name" varchar(255) not null, "unit_number" varchar(255) null, "area_sqm" double precision not null, "heating_area_sqm" double precision null, "created_at" varchar(255) not null default current_timestamp, "updated_at" varchar(255) not null default current_timestamp, primary key ("id"));`);
    this.addSql(`alter table "units" add constraint "units_building_name_unique" unique ("building_id", "name");`);

    this.addSql(`create table "tenants" ("id" varchar(255) not null, "unit_id" varchar(255) not null, "kind" varchar(255) not null default 'private', "start_date" varchar(255) not null, "end_date" varchar(255) null, "deposit_cents" int not null default 0, "notes" text null, "created_at" varchar(255) not null default current_timestamp, "updated_at" varchar(255) not null default current_timestamp, primary key ("id"));`);
    this.addSql(`create index "tenants_unit_id" on "tenants" ("unit_id");`);

    this.addSql(`create table "tenant_residents" ("id" varchar(255) not null, "tenant_id" varchar(255) not null, "resident_id" varchar(255) not null, "move_in_date" varchar(255) null, "move_out_date" varchar(255) null, "is_contract_party" int not null default 1, "created_at" varchar(255) not null default current_timestamp, "updated_at" varchar(255) not null default current_timestamp, primary key ("id"));`);
    this.addSql(`alter table "tenant_residents" add constraint "tenant_residents_tenant_resident_unique" unique ("tenant_id", "resident_id");`);

    this.addSql(`create table "tenant_rents" ("id" varchar(255) not null, "tenant_id" varchar(255) not null, "start_date" varchar(255) null, "end_date" varchar(255) null, "monthly_base_rent_cents" int not null, "monthly_advance_cents" int not null, "reduction_reason" text null, "created_at" varchar(255) not null default current_timestamp, "updated_at" varchar(255) not null default current_timestamp, primary key ("id"));`);
    this.addSql(`create index "tenant_rents_tenant_id" on "tenant_rents" ("tenant_id");`);

    this.addSql(`create table "tenant_bank_accounts" ("id" varchar(255) not null, "tenant_id" varchar(255) not null, "start_date" varchar(255) null, "end_date" varchar(255) null, "iban" varchar(255) not null, "bic" varchar(255) null, "account_holder" varchar(255) not null, "mandate_reference" varchar(255) null, "mandate_signed_at" varchar(255) null, "created_at" varchar(255) not null default current_timestamp, "updated_at" varchar(255) not null default current_timestamp, primary key ("id"));`);
    this.addSql(`create index "tenant_bank_accounts_tenant_id" on "tenant_bank_accounts" ("tenant_id");`);

    this.addSql(`create table "tenant_addresses" ("id" varchar(255) not null, "tenant_id" varchar(255) not null, "start_date" varchar(255) null, "end_date" varchar(255) null, "street" varchar(255) not null, "postal_code" varchar(255) not null, "city" varchar(255) not null, "created_at" varchar(255) not null default current_timestamp, "updated_at" varchar(255) not null default current_timestamp, primary key ("id"));`);
    this.addSql(`create index "tenant_addresses_tenant_id" on "tenant_addresses" ("tenant_id");`);

    this.addSql(`create table "payments" ("id" varchar(255) not null, "tenant_id" varchar(255) not null, "payment_date" varchar(255) not null, "reference" varchar(255) null, "for_month" varchar(255) null, "for_statement_id" varchar(255) null, "for_deposit" boolean not null default false, "for_fee_id" varchar(255) null, "base_rent_cents" int null, "advance_cents" int null, "amount_cents" int null, "created_at" varchar(255) not null default current_timestamp, "updated_at" varchar(255) not null default current_timestamp, primary key ("id"));`);
    this.addSql(`create index "payments_tenant_id" on "payments" ("tenant_id");`);

    this.addSql(`create table "account_fees" ("id" varchar(255) not null, "tenant_id" varchar(255) not null, "date" varchar(255) not null, "amount_cents" int not null, "reason" text not null, "created_at" varchar(255) not null default current_timestamp, "updated_at" varchar(255) not null default current_timestamp, primary key ("id"));`);
    this.addSql(`create index "account_fees_tenant_id" on "account_fees" ("tenant_id");`);

    this.addSql(`create table "meters" ("id" varchar(255) not null, "building_id" varchar(255) not null, "unit_id" varchar(255) null, "type" varchar(255) not null, "role" varchar(255) not null, "label" varchar(255) not null, "serial_number" varchar(255) null, "measurement_unit" varchar(255) not null, "room" varchar(255) null, "cost_allocation_mode" varchar(255) not null default 'cost_types', "radiator" varchar(255) null, "k_total" double precision null, "radiator_manufacturer" varchar(255) null, "radiator_model" varchar(255) null, "radiator_type" varchar(255) null, "radiator_dimensions" varchar(255) null, "valid_from" varchar(255) not null, "valid_until" varchar(255) null, "is_active" boolean not null default true, "is_remote_readable" boolean not null default false, "created_at" varchar(255) not null default current_timestamp, "updated_at" varchar(255) not null default current_timestamp, primary key ("id"));`);
    this.addSql(`alter table "meters" add constraint "meters_serial_unique" unique ("serial_number");`);

    this.addSql(`create table "meter_readings" ("id" varchar(255) not null, "meter_id" varchar(255) not null, "reading_date" varchar(255) not null, "value" double precision not null, "is_cumulative" boolean not null default true, "is_estimated" boolean not null default false, "read_by" varchar(255) not null default 'landlord', "notes" text null, "created_at" varchar(255) not null default current_timestamp, "updated_at" varchar(255) not null default current_timestamp, primary key ("id"));`);
    this.addSql(`alter table "meter_readings" add constraint "meter_readings_meter_date" unique ("meter_id", "reading_date");`);

    this.addSql(`create table "meter_gas_factors" ("id" varchar(255) not null, "meter_id" varchar(255) not null, "valid_from" varchar(255) not null, "valid_until" varchar(255) null, "energy_factor_kwh_per_m3" double precision null, "notes" text null, "created_at" varchar(255) not null default current_timestamp, "updated_at" varchar(255) not null default current_timestamp, primary key ("id"));`);
    this.addSql(`alter table "meter_gas_factors" add constraint "meter_gas_factors_meter_from" unique ("meter_id", "valid_from");`);

    this.addSql(`create table "meter_difference_components" ("id" varchar(255) not null, "virtual_meter_id" varchar(255) not null, "source_meter_id" varchar(255) not null, "kind" varchar(255) not null, "created_at" varchar(255) not null default current_timestamp, "updated_at" varchar(255) not null default current_timestamp, primary key ("id"));`);
    this.addSql(`alter table "meter_difference_components" add constraint "meter_diff_components_unique" unique ("virtual_meter_id", "source_meter_id");`);

    this.addSql(`create table "meter_cost_type_assignments" ("meter_id" varchar(255) not null, "cost_type_id" varchar(255) not null, "created_at" varchar(255) not null default current_timestamp, primary key ("meter_id", "cost_type_id"));`);

    this.addSql(`create table "climate_factors" ("id" varchar(255) not null, "postal_code" varchar(255) not null, "period_start" varchar(255) not null, "period_end" varchar(255) not null, "factor" double precision not null, "is_manual" boolean not null default false, "created_at" varchar(255) not null default current_timestamp, "updated_at" varchar(255) not null default current_timestamp, primary key ("id"));`);
    this.addSql(`alter table "climate_factors" add constraint "climate_factors_postal_code_period" unique ("postal_code", "period_start", "period_end");`);
    this.addSql(`create table "heating_settings" ("id" varchar(255) not null, "building_id" varchar(255) not null, "mode" varchar(255) not null, "base_share_percent" int not null default 30, "consumption_share_percent" int not null default 70, "base_method" varchar(255) not null default 'area', "consumption_method" varchar(255) not null default 'heat_meter', "proration_method" varchar(255) not null default 'linear', "heating_type" varchar(255) not null default 'central_without_hot_water', "fuel_type" varchar(255) not null default 'gas', "hot_water_meter_id" varchar(255) null, "hot_water_supply_temperature_celsius" int not null default 60, "total_heat_energy_kwh" double precision null, "gas_billing_by_calorific_value" boolean not null default false, "heat_pump_monovalent" boolean not null default false, "mandatory_seventy_percent" boolean not null default false, "district_heat_emissions_kg_per_year" double precision null, "district_heat_primary_energy_factor" double precision null, "include_billing_info" boolean not null default true, "co2_cost_share_enabled" boolean not null default true, "valid_from" varchar(255) not null default '1900-01-01', "valid_to" varchar(255) null, "created_at" varchar(255) not null default current_timestamp, "updated_at" varchar(255) not null default current_timestamp, primary key ("id"));`);
    this.addSql(`alter table "heating_settings" add constraint "heating_settings_building_id_valid_from_unique" unique ("building_id", "valid_from");`);

    this.addSql(`create table "external_heating_entries" ("id" varchar(255) not null, "building_id" varchar(255) not null, "unit_id" varchar(255) not null, "period_start" varchar(255) not null, "period_end" varchar(255) not null, "total_cents" int not null, "base_cost_cents" int null, "consumption_cost_cents" int null, "notes" text null, "created_at" varchar(255) not null default current_timestamp, "updated_at" varchar(255) not null default current_timestamp, primary key ("id"));`);
    this.addSql(`create index "external_heating_entries_building_id" on "external_heating_entries" ("building_id");`);
    this.addSql(`create index "external_heating_entries_unit_id" on "external_heating_entries" ("unit_id");`);

    this.addSql(`create table "cost_entry_items" ("id" varchar(255) not null, "cost_entry_id" varchar(255) not null, "cost_type_id" varchar(255) not null, "unit_id" varchar(255) null, "amount_cents" int not null, "unit_price_cents" int null, "labor_costs_cents" int null, "co2_amount_grams" int null, "co2_cost_cents" int null, "contained_taxes_cents" int null, "contained_tax_kinds" jsonb null, "period_start" varchar(255) not null, "period_end" varchar(255) not null, "position" int not null default 0, "created_at" varchar(255) not null default current_timestamp, "updated_at" varchar(255) not null default current_timestamp, primary key ("id"));`);
    this.addSql(`create index "cost_entry_items_cost_entry_id" on "cost_entry_items" ("cost_entry_id");`);
    this.addSql(`create index "cost_entry_items_cost_type_id" on "cost_entry_items" ("cost_type_id");`);
    this.addSql(`create index "cost_entry_items_unit_id" on "cost_entry_items" ("unit_id");`);

    this.addSql(`create table "users" ("id" varchar(255) not null, "email" varchar(255) not null, "first_name" varchar(255) null, "last_name" varchar(255) null, "password_hash" varchar(255) not null, "role" varchar(255) not null default 'resident', "resident_id" varchar(255) null, "last_login_at" varchar(255) null, "created_at" varchar(255) not null default current_timestamp, "updated_at" varchar(255) not null default current_timestamp, primary key ("id"));`);
    this.addSql(`alter table "users" add constraint "users_email_unique" unique ("email");`);

    this.addSql(`create table "sessions" ("id" varchar(255) not null, "user_id" varchar(255) not null, "expires_at" varchar(255) not null, "created_at" varchar(255) not null default current_timestamp, primary key ("id"));`);
    this.addSql(`create index "sessions_user_id" on "sessions" ("user_id");`);

    this.addSql(`create table "operating_cost_statements" ("id" varchar(255) not null, "building_id" varchar(255) not null, "tenant_id" varchar(255) not null, "period_start" varchar(255) not null, "period_end" varchar(255) not null, "document_date" varchar(255) null, "status" varchar(255) not null default 'draft', "snapshot_data" jsonb null, "total_costs_cents" int null, "total_advances_cents" int null, "balance_cents" int null, "adjusted_monthly_advance_cents" int null, "adjusted_advance_valid_from" varchar(255) null, "tariff_adjustment_bps" jsonb null, "finalized_at" varchar(255) null, "finalized_by_user_id" varchar(255) null, "pdf_path" text null, "sequence_number" int null, "revision_number" int null, "sent_at" varchar(255) null, "supersedes_statement_id" varchar(255) null, "cancelled_at" varchar(255) null, "cancelled_by_user_id" varchar(255) null, "cancellation_reason" text null, "notes" text null, "created_at" varchar(255) not null default current_timestamp, "updated_at" varchar(255) not null default current_timestamp, primary key ("id"));`);
    this.addSql(`create index "operating_cost_statements_tenant_id" on "operating_cost_statements" ("tenant_id");`);
    this.addSql(`create index "operating_cost_statements_building_id" on "operating_cost_statements" ("building_id");`);

    this.addSql(`create table "account_settlements" ("id" varchar(255) not null, "tenant_id" varchar(255) not null, "statement_id" varchar(255) not null, "date" varchar(255) not null, "amount_cents" int not null, "created_at" varchar(255) not null default current_timestamp, primary key ("id"));`);
    this.addSql(`create index "account_settlements_tenant_id" on "account_settlements" ("tenant_id");`);
    this.addSql(`create index "account_settlements_statement_id" on "account_settlements" ("statement_id");`);
    this.addSql(`alter table "account_settlements" add constraint "account_settlements_statement_id_unique" unique ("statement_id");`);

    this.addSql(`alter table "cost_entry_attachments" add constraint "cost_entry_attachments_cost_entry_id_foreign" foreign key ("cost_entry_id") references "cost_entries" ("id") on delete cascade;`);

    this.addSql(`alter table "cost_entries" add constraint "cost_entries_building_id_foreign" foreign key ("building_id") references "buildings" ("id") on delete restrict;`);
    this.addSql(`alter table "cost_types" add constraint "cost_types_building_id_foreign" foreign key ("building_id") references "buildings" ("id") on delete restrict;`);

    this.addSql(`alter table "units" add constraint "units_building_id_foreign" foreign key ("building_id") references "buildings" ("id") on delete restrict;`);

    this.addSql(`alter table "tenants" add constraint "tenants_unit_id_foreign" foreign key ("unit_id") references "units" ("id") on delete restrict;`);

    this.addSql(`alter table "tenant_residents" add constraint "tenant_residents_tenant_id_foreign" foreign key ("tenant_id") references "tenants" ("id") on delete cascade;`);
    this.addSql(`alter table "tenant_residents" add constraint "tenant_residents_resident_id_foreign" foreign key ("resident_id") references "residents" ("id") on delete restrict;`);

    this.addSql(`alter table "tenant_rents" add constraint "tenant_rents_tenant_id_foreign" foreign key ("tenant_id") references "tenants" ("id") on delete cascade;`);

    this.addSql(`alter table "tenant_bank_accounts" add constraint "tenant_bank_accounts_tenant_id_foreign" foreign key ("tenant_id") references "tenants" ("id") on delete cascade;`);

    this.addSql(`alter table "tenant_addresses" add constraint "tenant_addresses_tenant_id_foreign" foreign key ("tenant_id") references "tenants" ("id") on delete cascade;`);

    this.addSql(`alter table "payments" add constraint "payments_tenant_id_foreign" foreign key ("tenant_id") references "tenants" ("id") on delete restrict;`);

    this.addSql(`alter table "account_fees" add constraint "account_fees_tenant_id_foreign" foreign key ("tenant_id") references "tenants" ("id") on delete restrict;`);

    this.addSql(`alter table "meters" add constraint "meters_building_id_foreign" foreign key ("building_id") references "buildings" ("id") on delete restrict;`);
    this.addSql(`alter table "meters" add constraint "meters_unit_id_foreign" foreign key ("unit_id") references "units" ("id") on delete restrict;`);

    this.addSql(`alter table "meter_readings" add constraint "meter_readings_meter_id_foreign" foreign key ("meter_id") references "meters" ("id") on delete restrict;`);

    this.addSql(`alter table "meter_gas_factors" add constraint "meter_gas_factors_meter_id_foreign" foreign key ("meter_id") references "meters" ("id") on delete cascade;`);

    this.addSql(`alter table "meter_difference_components" add constraint "meter_difference_components_virtual_meter_id_foreign" foreign key ("virtual_meter_id") references "meters" ("id") on delete cascade;`);
    this.addSql(`alter table "meter_difference_components" add constraint "meter_difference_components_source_meter_id_foreign" foreign key ("source_meter_id") references "meters" ("id") on delete restrict;`);

    this.addSql(`alter table "meter_cost_type_assignments" add constraint "meter_cost_type_assignments_meter_id_foreign" foreign key ("meter_id") references "meters" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "meter_cost_type_assignments" add constraint "meter_cost_type_assignments_cost_type_id_foreign" foreign key ("cost_type_id") references "cost_types" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table "heating_settings" add constraint "heating_settings_building_id_foreign" foreign key ("building_id") references "buildings" ("id") on delete restrict;`);
    this.addSql(`alter table "heating_settings" add constraint "heating_settings_hot_water_meter_id_foreign" foreign key ("hot_water_meter_id") references "meters" ("id") on delete set null;`);

    this.addSql(`alter table "external_heating_entries" add constraint "external_heating_entries_building_id_foreign" foreign key ("building_id") references "buildings" ("id") on delete restrict;`);
    this.addSql(`alter table "external_heating_entries" add constraint "external_heating_entries_unit_id_foreign" foreign key ("unit_id") references "units" ("id") on delete restrict;`);

    this.addSql(`alter table "cost_entry_items" add constraint "cost_entry_items_cost_entry_id_foreign" foreign key ("cost_entry_id") references "cost_entries" ("id") on delete cascade;`);
    this.addSql(`alter table "cost_entry_items" add constraint "cost_entry_items_cost_type_id_foreign" foreign key ("cost_type_id") references "cost_types" ("id") on delete restrict;`);
    this.addSql(`alter table "cost_entry_items" add constraint "cost_entry_items_unit_id_foreign" foreign key ("unit_id") references "units" ("id") on delete restrict;`);

    this.addSql(`alter table "users" add constraint "users_resident_id_foreign" foreign key ("resident_id") references "residents" ("id") on delete set null;`);

    this.addSql(`alter table "sessions" add constraint "sessions_user_id_foreign" foreign key ("user_id") references "users" ("id") on delete cascade;`);

    this.addSql(`alter table "operating_cost_statements" add constraint "operating_cost_statements_building_id_foreign" foreign key ("building_id") references "buildings" ("id") on delete restrict;`);
    this.addSql(`alter table "operating_cost_statements" add constraint "operating_cost_statements_tenant_id_foreign" foreign key ("tenant_id") references "tenants" ("id") on delete restrict;`);
    this.addSql(`alter table "operating_cost_statements" add constraint "operating_cost_statements_finalized_by_user_id_foreign" foreign key ("finalized_by_user_id") references "users" ("id") on delete set null;`);
    this.addSql(`alter table "operating_cost_statements" add constraint "operating_cost_statements_cancelled_by_user_id_foreign" foreign key ("cancelled_by_user_id") references "users" ("id") on delete set null;`);

    this.addSql(`alter table "account_settlements" add constraint "account_settlements_tenant_id_foreign" foreign key ("tenant_id") references "tenants" ("id") on delete restrict;`);
    this.addSql(`alter table "account_settlements" add constraint "account_settlements_statement_id_foreign" foreign key ("statement_id") references "operating_cost_statements" ("id") on delete restrict;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "cost_types" drop constraint "cost_types_building_id_foreign";`);
    this.addSql(`alter table "units" drop constraint "units_building_id_foreign";`);
    this.addSql(`alter table "meters" drop constraint "meters_building_id_foreign";`);
    this.addSql(`alter table "heating_settings" drop constraint "heating_settings_building_id_foreign";`);
    this.addSql(`alter table "external_heating_entries" drop constraint "external_heating_entries_building_id_foreign";`);
    this.addSql(`alter table "operating_cost_statements" drop constraint "operating_cost_statements_building_id_foreign";`);
    this.addSql(`alter table "cost_entry_attachments" drop constraint "cost_entry_attachments_cost_entry_id_foreign";`);
    this.addSql(`alter table "cost_entry_items" drop constraint "cost_entry_items_cost_entry_id_foreign";`);
    this.addSql(`alter table "meter_cost_type_assignments" drop constraint "meter_cost_type_assignments_cost_type_id_foreign";`);
    this.addSql(`alter table "cost_entry_items" drop constraint "cost_entry_items_cost_type_id_foreign";`);
    this.addSql(`alter table "tenant_residents" drop constraint "tenant_residents_resident_id_foreign";`);
    this.addSql(`alter table "users" drop constraint "users_resident_id_foreign";`);
    this.addSql(`alter table "tenants" drop constraint "tenants_unit_id_foreign";`);
    this.addSql(`alter table "meters" drop constraint "meters_unit_id_foreign";`);
    this.addSql(`alter table "external_heating_entries" drop constraint "external_heating_entries_unit_id_foreign";`);
    this.addSql(`alter table "cost_entry_items" drop constraint "cost_entry_items_unit_id_foreign";`);
    this.addSql(`alter table "tenant_residents" drop constraint "tenant_residents_tenant_id_foreign";`);
    this.addSql(`alter table "tenant_rents" drop constraint "tenant_rents_tenant_id_foreign";`);
    this.addSql(`alter table "tenant_bank_accounts" drop constraint "tenant_bank_accounts_tenant_id_foreign";`);
    this.addSql(`alter table "tenant_addresses" drop constraint "tenant_addresses_tenant_id_foreign";`);
    this.addSql(`alter table "payments" drop constraint "payments_tenant_id_foreign";`);
    this.addSql(`alter table "account_fees" drop constraint "account_fees_tenant_id_foreign";`);
    this.addSql(`alter table "operating_cost_statements" drop constraint "operating_cost_statements_tenant_id_foreign";`);
    this.addSql(`alter table "account_settlements" drop constraint "account_settlements_tenant_id_foreign";`);
    this.addSql(`alter table "meter_readings" drop constraint "meter_readings_meter_id_foreign";`);
    this.addSql(`alter table "meter_gas_factors" drop constraint "meter_gas_factors_meter_id_foreign";`);
    this.addSql(`alter table "meter_difference_components" drop constraint "meter_difference_components_virtual_meter_id_foreign";`);
    this.addSql(`alter table "meter_difference_components" drop constraint "meter_difference_components_source_meter_id_foreign";`);
    this.addSql(`alter table "meter_cost_type_assignments" drop constraint "meter_cost_type_assignments_meter_id_foreign";`);
    this.addSql(`alter table "heating_settings" drop constraint "heating_settings_hot_water_meter_id_foreign";`);
    this.addSql(`alter table "sessions" drop constraint "sessions_user_id_foreign";`);
    this.addSql(`alter table "operating_cost_statements" drop constraint "operating_cost_statements_finalized_by_user_id_foreign";`);
    this.addSql(`alter table "operating_cost_statements" drop constraint "operating_cost_statements_cancelled_by_user_id_foreign";`);
    this.addSql(`alter table "account_settlements" drop constraint "account_settlements_statement_id_foreign";`);

    this.addSql(`drop table if exists "app_settings" cascade;`);
    this.addSql(`drop table if exists "buildings" cascade;`);
    this.addSql(`drop table if exists "cost_entries" cascade;`);
    this.addSql(`drop table if exists "cost_entry_attachments" cascade;`);
    this.addSql(`drop table if exists "cost_types" cascade;`);
    this.addSql(`drop table if exists "residents" cascade;`);
    this.addSql(`drop table if exists "units" cascade;`);
    this.addSql(`drop table if exists "tenants" cascade;`);
    this.addSql(`drop table if exists "tenant_residents" cascade;`);
    this.addSql(`drop table if exists "tenant_rents" cascade;`);
    this.addSql(`drop table if exists "tenant_bank_accounts" cascade;`);
    this.addSql(`drop table if exists "tenant_addresses" cascade;`);
    this.addSql(`drop table if exists "payments" cascade;`);
    this.addSql(`drop table if exists "account_fees" cascade;`);
    this.addSql(`drop table if exists "meters" cascade;`);
    this.addSql(`drop table if exists "meter_readings" cascade;`);
    this.addSql(`drop table if exists "meter_gas_factors" cascade;`);
    this.addSql(`drop table if exists "meter_difference_components" cascade;`);
    this.addSql(`drop table if exists "meter_cost_type_assignments" cascade;`);
    this.addSql(`drop table if exists "heating_settings" cascade;`);
    this.addSql(`drop table if exists "external_heating_entries" cascade;`);
    this.addSql(`drop table if exists "cost_entry_items" cascade;`);
    this.addSql(`drop table if exists "users" cascade;`);
    this.addSql(`drop table if exists "sessions" cascade;`);
    this.addSql(`drop table if exists "operating_cost_statements" cascade;`);
    this.addSql(`drop table if exists "account_settlements" cascade;`);
    this.addSql(`drop table if exists "climate_factors" cascade;`);
  }

}
