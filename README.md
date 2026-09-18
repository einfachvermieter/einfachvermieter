# EinfachVermieter

Software für private Vermieter: Immobilien, Mieter, Verträge, Zählerstände und
Betriebskosten verwalten und daraus Nebenkostenabrechnungen als PDF erstellen.

Website: <https://einfachvermieter.de> | Anleitung:
<https://einfachvermieter.de/anleitung>

> **Beta:** Bitte prüfen Sie jede Abrechnung nach, bevor Sie sie verschicken.
> Was Ihnen dabei auffällt, melden Sie bitte unter [Fehler
> melden](#fehler-melden).

## Funktionsumfang

- Gebäude, Wohnungen und Mieter verwalten
- Zahlungseingänge den Mieten und Nebenkosten-Vorauszahlungen zuordnen
- Zählerstände: Wasser (mit Differenzzähler-Logik), Strom, Gas, Heizkostenverteiler
- Betriebskosten mit verschiedenen Umlageschlüsseln (qm, Personen, pro Wohnung,
  Verbrauch, HeizkostenV, fest)
- Abrechnungen mit Live-PDF-Vorschau, finalisierbar und unveränderlich
  (inkl. Storno-/Korrektur-Workflow)
- Heizkosten nach HeizkostenV inkl. Warmwasser-Abspaltung und CO2-Kostenaufteilung
- Optionales KI-Vorausfüllen von Lieferantenrechnungen (Mistral, OpenAI,
  Anthropic, Gemini oder lokal per Ollama)

## Bekannte Grenzen

- **Nur Wohnraumvermietung**, keine gewerbliche Vermietung (Brutto/Netto,
  Steuerausweis, andere Fristen und CO2-Verteilung).
- **Ersatzverfahren nach § 9a HeizkostenV nur als Flächen-Fallback** mit
  Hinweis auf das Kürzungsrecht; Ersatzwerte aus Vergleichszeiträumen und die
  25-%-Grenze sind nicht umgesetzt.
- **Keine unterjährige Verbrauchsinformation** nach § 6a Abs. 1 und 2
  HeizkostenV; die App deckt nur die Jahresabrechnung ab.

## Installation

Beide Varianten haben denselben Funktionsumfang. Die Datenbank legt die App
beim Start selbst an und bringt sie auf den aktuellen Stand, der erste Aufruf
führt durch den Einrichtungs-Assistenten.

### Docker

```bash
docker run -d --name einfachvermieter --restart unless-stopped \
  -p 7273:7273 -e TZ=Europe/Berlin \
  -v "/lokal/auf/host/data:/data" \
  einfachvermieter/einfachvermieter:latest
```

Danach <http://localhost:7273> im Browser öffnen. Alle Daten liegen im
gemounteten Ordner `data`, eine eigene Datenbank ist nicht nötig.

Die Fassung als `docker-compose.yml`, alle Umgebungsvariablen, Betrieb hinter
einem Reverse-Proxy, Sicherung und Aktualisieren stehen in
[docs/deployment.md](docs/deployment.md).

### Desktop-App

Windows und macOS als Download auf <https://einfachvermieter.de/download>.

## Fehler melden

Fehlerberichte und Fragen zur Fachlichkeit gehören in die
[Issues](https://github.com/einfachvermieter/einfachvermieter/issues).
Hilfreich sind die Version, das Betriebssystem und der Weg, auf dem der Fehler
auftritt.

Sicherheitslücken bitte nicht als Issue melden, sondern wie in
[SECURITY.md](SECURITY.md) beschrieben. Wer selbst etwas beitragen möchte,
findet die Regeln in [CONTRIBUTING.md](CONTRIBUTING.md).

## Hintergrund

2022 haben wir ein Haus in der Familie übernommen und saniert. Ein Teil davon
ist vermietet, und seitdem steht einmal im Jahr die Nebenkostenabrechnung an,
mit Heizkostenverordnung und CO2-Kostenaufteilung.

Eine Excel-Tabelle war mir dafür zu unflexibel, und die Programme am Markt
haben mir nicht gepasst oder waren mir zu teuer. Also habe ich als
langjähriger Softwareentwickler selbst eines geschrieben.

Die App deckt in erster Linie den Bedarf in unserem eigenen Haus ab.
Inzwischen sind, auch mit Unterstützung von KI, etliche Fälle und Varianten
der Vermietung dazugekommen, die darüber hinausgehen.

## Lizenz

[Functional Source License 1.1, MIT Future License](LICENSE.md) (FSL-1.1-MIT).
