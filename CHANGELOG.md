# Änderungsprotokoll

Alle nennenswerten Änderungen für Anwender. Versionsschema:
JAHR.MINOR.PATCH, Vorabversionen mit `-beta.N`.

## Unveröffentlicht

- **Geändert:** Eine Mietzahlung lässt sich als ein Betrag erfassen, auch
  wenn sie von der Vertragsmiete abweicht.
- **Geändert:** Das Mieterkonto zeigt Zahlungen unter dem, wofür sie
  bestimmt sind.
- **Neu:** Mietsätze haben Änderungsgrund und Notiz, Mietverträge eine
  Mietart.
- **Neu:** Kostenarten lassen sich aus Vorlagen anlegen.
- **Neu:** Neue Gestaltung der ganzen Oberfläche.
- **Neu:** Die Grundkosten der Heizung lassen sich nach Wohnfläche oder
  beheizter Fläche verteilen.
- **Neu:** Die Heizkostenkonfiguration nimmt Beschränkungen nach § 9
  CO2KostAufG auf, etwa durch Denkmalschutz. Der Anteil des Vermieters an
  den CO₂-Kosten halbiert sich oder entfällt.
- **Neu:** Brennstoffrechnungen nehmen Energiegehalt und Emissionsfaktor
  auf. Die Heizkostenabrechnung weist die Herleitung des CO₂-Kostenanteils
  aus. Bei bestehenden Rechnungen sind die Werte nachzutragen.
- **Neu:** Die Heizfläche einer Wohnung darf 0 sein, wenn alle Heizkörper
  ausgebaut sind.
- **Neu:** Mit eingeschalteter Versionsprüfung zeigt die App wichtige
  Mitteilungen zur installierten Version.
- **Neu:** Schlägt eine Aktualisierung fehl, zeigt die App eine Seite mit
  dem Weg zurück.
- **Geändert:** Die Datenbank wird vor jeder Aktualisierung gesichert, jetzt
  auch im Docker-Betrieb (Ordner `backups`).
- **Geändert:** Als externe Datenbank gilt MariaDB ab 10.11 oder
  PostgreSQL. MySQL wird nicht unterstützt.
- **Geändert:** Die CO₂-Kostenaufteilung kürzt bei Zeiträumen unter einem
  Jahr die Stufengrenzen anteilig und zählt nur die Wohnfläche der zentral
  beheizten Wohnungen.
- **Geändert:** Gebäude ohne zentrale Heizung und ohne zentrales Warmwasser
  bekommen keine Heizkostenabrechnung mehr („Dezentrale Heizung“ heißt jetzt
  „Keine Heizkostenabrechnung“).
- **Geändert:** Fehlende CO₂-Angaben an einer Brennstoffrechnung, Kosten
  ohne verteilbare Fläche und Änderungen an der Anlage verhindern das
  Finalisieren der Abrechnung.
- **Behoben:** Im PDF bleiben Tabellen und ihre Fußnoten auf derselben
  Seite.
- **Behoben:** Auf dem iPhone vergrößert sich die Seite nicht mehr beim
  Antippen eines Felds.
- **Sicherheit:** Lücken beim Datei-Upload und in der Erkennung der
  Absenderadresse hinter einem Reverse-Proxy behoben, Abhängigkeiten
  aktualisiert.

## 2026.1.0-beta.1

Quellcode-Stand; keine Pakete veröffentlicht
