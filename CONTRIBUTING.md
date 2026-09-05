# Mitwirken

Danke für Ihr Interesse. Das Projekt ist eine private Hausverwaltungs-App
für deutsche Nebenkostenabrechnungen und wird nebenberuflich gepflegt.
Fehlerberichte, Fragen zur Fachlichkeit und kleine, klar umrissene Pull
Requests sind willkommen. Größere Änderungen bitte vorher in einem Issue
besprechen, damit keine Arbeit ins Leere läuft.

Sicherheitslücken bitte nicht als Issue melden, sondern wie in
[SECURITY.md](SECURITY.md) beschrieben.

## Setup

Voraussetzungen und erste Schritte stehen in
[docs/development.md](docs/development.md). Kurzfassung:

```bash
nvm use
npm install
npm run setup
cp .env.example .env
npm run db:reset:demo
npm run dev            # Web :7272, API :7273
```

## Vor dem Pull Request

Die CI führt dieselben Schritte aus:

```bash
npm run check:fix      # Biome: Lint + Format
npm run check
npm test
npm run build
```

Bitte nur Änderungen einreichen, bei denen alle vier Schritte grün sind.
Geld- und Anteilsberechnungen gehören nach `packages/shared`; API und
Frontend nutzen dieselben Funktionen, damit Vorschau und finale Abrechnung
identisch rechnen. Änderungen dort brauchen einen Test.

## Regeln in Kurzform

- **Sprache:** UI-Texte auf Deutsch in Sie-Form, ausschließlich in
  `packages/i18n/src/locales/de.json`, abgerufen über `t('ui.…')`. Keine
  hartkodierten Texte, keine aus Fragmenten zusammengesetzten Sätze.
  Kommentare und Doku ebenfalls auf Deutsch.
- **Geld** immer als Cent (Integer), **Datum** als ISO `YYYY-MM-DD`.
- **Datenbank:** Schema nur über die MikroORM-EntitySchemas in
  `packages/db/src/entities/`. Schema-Änderungen in allen Seed-Profilen
  nachziehen. Bis zum ersten Release keine neuen Migrationsdateien, sondern
  die initiale Migration je Dialekt anpassen.
- **Frontend:** shadcn-Komponenten ohne eigene `className`, Varianten
  nutzen. Fehlt eine Komponente, im PR oder Issue ansprechen statt sie
  selbst nachzubauen. Eine Komponente pro Datei, Datei nach dem Export
  benannt, Arrow Functions.
- **Tabellen:** numerische Spalten und deren Header rechtsbündig mit
  `tabular-nums`. Pagination `[25, 50, 100]`, Default 25.
- **Farben:** nur die projekteigenen Skalen (azur, limette, honig,
  himbeere, schiefer) aus `apps/web/src/index.css`, keine Tailwind-Defaults.
- **Fachbegriffe:** `heat_cost_allocator` = Heizkostenverteiler (Gerät),
  `heating_ordinance` = Heizkostenverordnung (Verteilschlüssel). Die beiden
  nie vermischen.

Alle Skripte, Ports und ENV-Variablen stehen in
[docs/development.md](docs/development.md), der Betrieb im Container in
[docs/deployment.md](docs/deployment.md).

## Lizenz

Beiträge werden unter der Lizenz des Projekts veröffentlicht
([LICENSE.md](LICENSE.md), FSL-1.1-MIT). Mit einem Pull Request stimmen
Sie dem zu.
