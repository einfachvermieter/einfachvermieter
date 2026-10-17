import { Migration } from '@mikro-orm/migrations';

export class Migration20261016190129 extends Migration {

  override name = 'Migration20261016190129';

  /**
   * Bestehende Konfigurationen rechneten immer nach der Fläche der beheizten
   * Räume und behalten diesen Maßstab. Neue Zeilen beginnen mit der
   * Wohnfläche.
   *
   * Nach einem Abbruch auf MariaDB wiederholbar: Das Update schreibt nur
   * Zeilen mit 'area' und ist danach ohne Wirkung. Bricht der Lauf nach dem
   * Update ab, setzt der zweite Lauf nur noch den Default; der lässt sich
   * beliebig oft setzen.
   */
  override up(): void | Promise<void> {
    this.addSql(`update \`heating_settings\` set \`base_method\` = 'heated_area' where \`base_method\` = 'area';`);
    this.addSql(`alter table \`heating_settings\` modify \`base_method\` varchar(255) not null default 'living_area';`);
  }

  /**
   * Nicht verlustfrei: Der gewählte Maßstab geht verloren, beide Werte werden
   * wieder zu 'area'.
   */
  override down(): void | Promise<void> {
    this.addSql(`update \`heating_settings\` set \`base_method\` = 'area';`);
    this.addSql(`alter table \`heating_settings\` modify \`base_method\` varchar(255) not null default 'area';`);
  }

}
