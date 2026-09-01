/**
 * Seed-Profil `minimal`: Das Nötigste für eine frische Installation: die
 * AppSettings-Singleton-Zeile. Bewusst **kein** Admin-User: ohne Benutzer
 * landet der Erststart im Einrichtungs-Assistenten (`/einrichtung`), der den
 * ersten Admin, optional die Absenderdaten und ein erstes Gebäude anlegt.
 *
 * Aufruf: npm run seed:minimal -w @einfachvermieter/db
 */
import { runSeed, runSeedAsScript, schema } from "./engine.js";

const main = runSeed("minimal", ({ insert }) => {
  insert(schema.appSettings, {
    id: schema.APP_SETTINGS_ID,
    logoMode: "none",
  });
});

runSeedAsScript(main);
