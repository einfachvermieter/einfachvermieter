import { Migration } from '@mikro-orm/migrations';

export class Migration20260924183515 extends Migration {

  override name = 'Migration20260924183515';

  override up(): void | Promise<void> {
    this.addSql(`create table \`consumption_substitutions\` (\`id\` varchar(255) not null, \`building_id\` varchar(255) not null, \`unit_id\` varchar(255) not null, \`period_start\` varchar(255) not null, \`period_end\` varchar(255) not null, \`scope\` varchar(255) not null, \`reason\` varchar(255) not null, \`reason_note\` text null, \`affected_meter_ids\` json not null, \`meter_kept_counting\` tinyint(1) null, \`affected_area_sqm\` double null, \`method\` varchar(255) not null, \`basis_source\` varchar(255) not null, \`reference_period_start\` varchar(255) null, \`reference_period_end\` varchar(255) null, \`reference_meter_ids\` json null, \`comparison_unit_ids\` json null, \`manual_affected_consumption\` double null, \`manual_total_consumption\` double null, \`manual_comparison_consumption\` double null, \`manual_comparison_area_sqm\` double null, \`basis_note\` text null, \`decided_by_user_id\` varchar(255) null, \`created_at\` varchar(255) not null default current_timestamp(), \`updated_at\` varchar(255) not null default current_timestamp(), primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`consumption_substitutions\` add index \`consumption_substitutions_unit_id_index\` (\`unit_id\`);`);
    this.addSql(`alter table \`consumption_substitutions\` add index \`consumption_substitutions_decided_by_user_id_index\` (\`decided_by_user_id\`);`);
    this.addSql(`alter table \`consumption_substitutions\` add index \`consumption_substitutions_building_id\` (\`building_id\`);`);
    this.addSql(`alter table \`consumption_substitutions\` add unique \`consumption_substitutions_unit_scope_period\` (\`unit_id\`, \`scope\`, \`period_start\`, \`period_end\`);`);

    this.addSql(`alter table \`consumption_substitutions\` add constraint \`consumption_substitutions_building_id_foreign\` foreign key (\`building_id\`) references \`buildings\` (\`id\`) on delete restrict;`);
    this.addSql(`alter table \`consumption_substitutions\` add constraint \`consumption_substitutions_unit_id_foreign\` foreign key (\`unit_id\`) references \`units\` (\`id\`) on delete restrict;`);
    this.addSql(`alter table \`consumption_substitutions\` add constraint \`consumption_substitutions_decided_by_user_id_foreign\` foreign key (\`decided_by_user_id\`) references \`users\` (\`id\`) on delete set null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists \`consumption_substitutions\`;`);
  }

}
