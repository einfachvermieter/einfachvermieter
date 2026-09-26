import { Migration } from '@mikro-orm/migrations';

export class Migration20260924183515 extends Migration {

  override name = 'Migration20260924183515';

  override up(): void | Promise<void> {
    this.addSql(`create table \`consumption_substitutions\` (\`id\` text not null primary key, \`building_id\` text not null, \`unit_id\` text not null, \`period_start\` text not null, \`period_end\` text not null, \`scope\` text not null, \`reason\` text not null, \`reason_note\` text null, \`affected_meter_ids\` json not null, \`meter_kept_counting\` integer null, \`affected_area_sqm\` double null, \`method\` text not null, \`basis_source\` text not null, \`reference_period_start\` text null, \`reference_period_end\` text null, \`reference_meter_ids\` json null, \`comparison_unit_ids\` json null, \`manual_affected_consumption\` double null, \`manual_total_consumption\` double null, \`manual_comparison_consumption\` double null, \`manual_comparison_area_sqm\` double null, \`basis_note\` text null, \`decided_by_user_id\` text null, \`created_at\` text not null default current_timestamp, \`updated_at\` text not null default current_timestamp, constraint \`consumption_substitutions_building_id_foreign\` foreign key (\`building_id\`) references \`buildings\` (\`id\`) on delete restrict, constraint \`consumption_substitutions_unit_id_foreign\` foreign key (\`unit_id\`) references \`units\` (\`id\`) on delete restrict, constraint \`consumption_substitutions_decided_by_user_id_foreign\` foreign key (\`decided_by_user_id\`) references \`users\` (\`id\`) on delete set null);`);
    this.addSql(`create index \`consumption_substitutions_unit_id_index\` on \`consumption_substitutions\` (\`unit_id\`);`);
    this.addSql(`create index \`consumption_substitutions_decided_by_user_id_index\` on \`consumption_substitutions\` (\`decided_by_user_id\`);`);
    this.addSql(`create index \`consumption_substitutions_building_id\` on \`consumption_substitutions\` (\`building_id\`);`);
    this.addSql(`create unique index \`consumption_substitutions_unit_scope_period\` on \`consumption_substitutions\` (\`unit_id\`, \`scope\`, \`period_start\`, \`period_end\`);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists \`consumption_substitutions\`;`);
  }

}
