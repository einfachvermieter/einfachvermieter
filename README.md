# EinfachVermieter

Software für private Vermieter: Immobilien, Mieter, Verträge, Zählerstände und
Betriebskosten verwalten und daraus Nebenkostenabrechnungen als PDF erstellen.

Website: <https://einfachvermieter.de> | Anleitung:
<https://einfachvermieter.de/anleitung>

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

### Docker

(`einfachvermieter/einfachvermieter` auf Docker
Hub): in der `docker-compose.yml` den `build:`-Block durch
`image: einfachvermieter/einfachvermieter:latest` ersetzen, dann
`docker compose up -d`.

Danach im Browser `http://<host>:7273` öffnen. Weitere Konfiguration
(z. B. Reverse-Proxy) siehe [docs/deployment.md](docs/deployment.md).

**Desktop-App**: Windows über den Microsoft Store, macOS als Download auf
<https://einfachvermieter.de>.

Die Datenbank wird beim Start angelegt und migriert; der erste Aufruf führt
durch den Einrichtungs-Assistenten.

## Entwicklung

Monorepo (Turborepo + npm workspaces): `apps/api` NestJS 11 + MikroORM 7
(SQLite/libsql, PostgreSQL oder MariaDB), `apps/web` React 19 + Vite +
TanStack + Tailwind v4 + shadcn, `apps/desktop` Electron-Wrapper,
`packages/{db,shared,pdf,i18n}` Entities/Migrationen, Berechnungen (unit-getestet), React-PDF.

Setup, Skripte und Tests stehen in [docs/development.md](docs/development.md),
die Regeln für Beiträge in [CONTRIBUTING.md](CONTRIBUTING.md).

## Hintergrund

2022 haben wir ein Haus in der Familie übernommen und saniert, ein Teil davon
ist vermietet. Einmal im Jahr steht seitdem eine Nebenkostenabrechnung an,
inklusive HeizkostenV, CO2-Kostenaufteilung, etc.

Eine Excel-Tabelle war mir zu unflexibel und die Softwares am Markt nicht das,
was ich mir vorgestellt hatte oder zu teuer. Also habe ich mich als langjähriger Softwareentwickler
selbst an die Sache gemacht.

Auch wenn die Software primär den Bedarf in unserem eigenen Haus abdeckt, habe
ich inzwischen, auch dank der Unterstützung von KI, etliche Fälle und Varianten
der Vermietung abgedeckt, die über unser privates Haus hinausgehen.

## Lizenz

[Functional Source License 1.1, MIT Future License](LICENSE.md) (FSL-1.1-MIT).
