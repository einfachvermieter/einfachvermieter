import { Migration } from '@mikro-orm/migrations';

export class Migration20261001190126 extends Migration {

  override name = 'Migration20261001190126';

  override up(): void | Promise<void> {
    this.addSql(`create table \`unit_supply_exclusions\` (\`id\` varchar(255) not null, \`unit_id\` varchar(255) not null, \`scope\` varchar(255) not null, \`valid_from\` varchar(255) not null, \`valid_until\` varchar(255) null, \`notes\` text null, \`created_at\` varchar(255) not null default current_timestamp(), \`updated_at\` varchar(255) not null default current_timestamp(), primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`unit_supply_exclusions\` add index \`unit_supply_exclusions_unit_id_index\` (\`unit_id\`);`);

    this.addSql(`alter table \`unit_supply_exclusions\` add constraint \`unit_supply_exclusions_unit_id_foreign\` foreign key (\`unit_id\`) references \`units\` (\`id\`) on delete restrict;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists \`unit_supply_exclusions\`;`);
  }

}
