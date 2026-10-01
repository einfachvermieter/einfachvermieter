import { Migration } from '@mikro-orm/migrations';

export class Migration20261001190126 extends Migration {

  override name = 'Migration20261001190126';

  override up(): void | Promise<void> {
    this.addSql(`create table \`unit_supply_exclusions\` (\`id\` text not null primary key, \`unit_id\` text not null, \`scope\` text not null, \`valid_from\` text not null, \`valid_until\` text null, \`notes\` text null, \`created_at\` text not null default current_timestamp, \`updated_at\` text not null default current_timestamp, constraint \`unit_supply_exclusions_unit_id_foreign\` foreign key (\`unit_id\`) references \`units\` (\`id\`) on delete restrict);`);
    this.addSql(`create index \`unit_supply_exclusions_unit_id_index\` on \`unit_supply_exclusions\` (\`unit_id\`);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists \`unit_supply_exclusions\`;`);
  }

}
