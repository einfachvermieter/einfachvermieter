# Änderungsprotokoll

Alle nennenswerten Änderungen für Anwender. Versionsschema:
JAHR.MINOR.PATCH, Vorabversionen mit `-beta.N`.

## Unveröffentlicht

- **Geändert:** Gebäude ohne zentrale Heizung und ohne zentrales
  Warmwasser bekommen keine Heizkostenabrechnung mehr. Option „Dezentrale Heizung“ heißt jetzt „Keine Heizkostenabrechnung“.
- **Behoben:** Im PDF bleiben Tabellen und ihre Fußnoten auf derselben
  Seite. Passt der Block nicht mehr, beginnt er auf der nächsten Seite.
- **Neu:** Die Grundkosten der Heizung lassen sich nach Wohnfläche oder
  nach beheizter Fläche verteilen. Bestehende Konfigurationen rechnen wie
  bisher nach beheizter Fläche.
- **Behoben:** Der Hinweis zum Warmwasser ohne erfassten Verbrauch nennt
  die Wohnfläche, nach der auch gerechnet wird.
- **Neu:** Mit eingeschalteter Versionsprüfung zeigt die App wichtige
  Mitteilungen zur installierten Version, etwa zu Sicherheitslücken oder
  bekannten Fehlern.
- **Geändert:** Ist der Projektserver kurz nicht erreichbar, bleibt der
  Hinweis auf eine neue Version stehen, und die App fragt nach einer Stunde
  erneut.
- **Neu:** Die Heizkostenkonfiguration nimmt Beschränkungen nach § 9
  CO2KostAufG auf, etwa durch Denkmalschutz oder Anschlusszwang. Der
  Anteil des Vermieters an den CO₂-Kosten wird dann halbiert oder entfällt.
- **Sicherheit:** Zwei Bibliotheken des Servers sind aktualisiert. Behoben
  sind eine Lücke bei der Erkennung der Absenderadresse hinter einem
  Reverse-Proxy und eine Lücke bei abgebrochenen Datei-Uploads.
- **Neu:** Schlägt eine Aktualisierung fehl, zeigt die App eine Seite mit
  dem Weg zurück, statt nicht mehr zu starten.
- **Geändert:** Die Datenbank wird vor jeder Aktualisierung, die sie
  umstellt, gesichert, jetzt auch im Docker-Betrieb. Die Sicherung liegt
  unter `backups` im Datenordner.
- **Geändert:** Als externe Datenbank gilt MariaDB ab 10.11 oder
  PostgreSQL. MySQL wird nicht unterstützt.
- **Geändert:** Bei einem Abrechnungszeitraum unter einem Jahr werden für
  die CO₂-Kostenaufteilung die Grenzwerte der Stufen anteilig gekürzt
  (§ 5 Abs. 1 Satz 4 CO2KostAufG). Der Ausstoß wird nicht mehr auf ein Jahr
  hochgerechnet. An einer Stufengrenze kann sich der Anteil des Vermieters
  dadurch um eine Stufe ändern.
- **Behoben:** Der Hinweis auf eine fehlende Ablesung zur Umstellung der
  Versorgung zeigt Wohnung, Zähler und Datum statt Platzhaltern.
- **Geändert:** Bei der CO₂-Kostenaufteilung zählt nur noch die Wohnfläche
  der Wohnungen, die aus der zentralen Anlage beheizt werden. Der Anteil des
  Vermieters kann dadurch steigen.
- **Neu:** Brennstoffrechnungen nehmen Energiegehalt und Emissionsfaktor
  auf. Die Heizkostenabrechnung weist beide Werte und die Herleitung des
  CO₂-Kostenanteils aus (§ 7 Abs. 3 CO2KostAufG). Bei bestehenden
  Brennstoffrechnungen sind die beiden Werte nachzutragen.
- **Geändert:** Fehlt an einer Brennstoffrechnung die CO₂-Menge oder der
  CO₂-Kostenanteil, lässt sich die Abrechnung erst finalisieren, wenn der
  Wert nachgetragen ist.
- **Geändert:** Gesamt-Wärmemenge und Fernwärme-Werte werden an der
  Abrechnung eingetragen, für jeden Abrechnungszeitraum neu.
- **Neu:** Hilfetexte zur Zählerart, zur geschätzten Ablesung und zur
  Abgrenzung der Energiekosten bei der Rechnungserfassung.
- **Behoben:** Lange Hilfetexte lassen sich scrollen und laufen nicht mehr
  aus dem Fenster.

## 2026.1.0-beta.1

Quellcode-Stand; keine Pakete veröffentlicht
