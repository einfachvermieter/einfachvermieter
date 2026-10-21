import { Migration } from '@mikro-orm/migrations';

export class Migration20261021191114 extends Migration {

  override name = 'Migration20261021191114';

  /**
   * Dezentrale Heizung ist kein Heizungstyp mehr, sondern der Modus ohne
   * Heizkostenabrechnung. Die übrigen Spalten behalten ihre Werte, haben in
   * diesem Modus aber keine Bedeutung.
   *
   * Nach einem Abbruch auf MariaDB wiederholbar: Es gibt nur diesen einen
   * Befehl, und danach trifft er keine Zeile mehr.
   */
  override up(): void | Promise<void> {
    this.addSql(`update \`heating_settings\` set \`mode\` = 'none', \`heating_type\` = 'central_without_hot_water' where \`heating_type\` = 'decentralized';`);
  }

  /**
   * Macht auch Einträge, die erst nach dieser Migration ohne
   * Heizkostenabrechnung angelegt wurden, wieder zu dezentraler Heizung.
   */
  override down(): void | Promise<void> {
    this.addSql(`update \`heating_settings\` set \`mode\` = 'internal', \`heating_type\` = 'decentralized' where \`mode\` = 'none';`);
  }

}
