import { Migration } from '@mikro-orm/migrations';

export class Migration20261001190126 extends Migration {

  override name = 'Migration20261001190126';

  /**
   * Ein Befehl mit `if not exists`, damit die Migration auf MariaDB nach
   * einem Abbruch erneut durchläuft: Ist die Tabelle da, ist sie vollständig.
   */
  override up(): void | Promise<void> {
    this.addSql(`create table if not exists \`unit_supply_exclusions\` (\`id\` varchar(255) not null, \`unit_id\` varchar(255) not null, \`scope\` varchar(255) not null, \`valid_from\` varchar(255) not null, \`valid_until\` varchar(255) null, \`notes\` text null, \`created_at\` varchar(255) not null default current_timestamp(), \`updated_at\` varchar(255) not null default current_timestamp(), primary key (\`id\`), index \`unit_supply_exclusions_unit_id_index\` (\`unit_id\`), constraint \`unit_supply_exclusions_unit_id_foreign\` foreign key (\`unit_id\`) references \`units\` (\`id\`) on delete restrict) default character set utf8mb4 engine = InnoDB;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists \`unit_supply_exclusions\`;`);
  }

}
