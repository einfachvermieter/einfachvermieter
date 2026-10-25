import { Migration } from '@mikro-orm/migrations';

export class Migration20261018194948 extends Migration {

  override name = 'Migration20261018194948';

  /**
   * Antworten auf die Fragen hinter den Schaltern zu 70 % und zur
   * CO2-Beschränkung. Bestehende Zeilen bekommen NULL (nicht gefragt).
   *
   * Ein Befehl mit `if not exists`, damit die Migration auf MariaDB nach
   * einem Abbruch erneut durchläuft.
   */
  override up(): void | Promise<void> {
    this.addSql(`alter table \`heating_settings\` add column if not exists \`seventy_insulation_answer\` varchar(255) null, add column if not exists \`seventy_pipes_answer\` varchar(255) null, add column if not exists \`co2_building_restriction_answer\` varchar(255) null, add column if not exists \`co2_supply_restriction_answer\` varchar(255) null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`heating_settings\` drop column \`seventy_insulation_answer\`, drop column \`seventy_pipes_answer\`, drop column \`co2_building_restriction_answer\`, drop column \`co2_supply_restriction_answer\`;`);
  }

}
