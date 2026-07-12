# EinfachVermieter

Software für private Vermieter: Immobilien, Mieter, Verträge, Zählerstände und
Betriebskosten verwalten und daraus Nebenkostenabrechnungen als PDF erstellen.

## Hintergrund

2022 haben wir ein Haus in der Familie übernommen und saniert, ein Teil davon
ist vermietet. Einmal im Jahr steht seitdem eine Nebenkostenabrechnung an,
inklusive HeizkostenV, CO2-Kostenaufteilung, etc.

Anstatt ein paar Euro in eine kommerzielle Software zu investieren oder es einfach
weiter mit Excel zu machen, habe ich mich als Programmierer lieber hingesetzt und
monatelang eine eigene Software gebaut.

Das Projekt war gar nicht so groß geplant. Aber da hatte ich unterschätzt, wie
komplex das Thema doch ist. Ich hatte ein paar Repos und viel zu viele Dinge von
uns hardcoded im Code oder irgendwo in der Git-History. Also habe ich mich mal
hingesetzt und das ganze sauber in einem Mono-Repo zusammengeführt.

Auch wenn die Software primär den Bedarf in unserem eigenen Haus abdeckt, habe
ich inzwischen auch ein paar darüber hinausgehende Fälle bereits umgesetzt, und
ich versuche, den Funktionsumfang künftig weiter auszubauen.

## Funktionsumfang

- Gebäude, Wohnungen und Mieter verwalten
- Zahlungseingänge den Mieten und Nebenkosten-Vorauszahlungen zuordnen
- Zählerstände: Wasser (mit Differenzzähler-Logik), Strom, Gas, Heizkostenverteiler
- Betriebskosten mit verschiedenen Umlageschlüsseln (qm, Personen, pro Wohnung,
  Verbrauch, HeizkostenV, fest)
- Abrechnungen mit Live-PDF-Vorschau, finalisierbar und unveränderlich
  (inkl. Storno-/Korrektur-Workflow)
- Heizkosten nach HeizkostenV inkl. Warmwasser-Abspaltung und CO2-Kostenaufteilung
- Optionales KI-Vorausfüllen von Lieferantenrechnungen (Mistral OCR)

## Stack

- Monorepo (Turborepo + npm workspaces)
- **Backend:** NestJS 11 + MikroORM 7
- **Datenbank:** SQLite/libsql (Default), PostgreSQL oder MariaDB
- **Frontend:** React 19 + Vite + TanStack Query/Router/Table + Tailwind v4 + shadcn
- **PDF:** React-PDF
- **Auth:** Serverseitige Session im httpOnly-Cookie, Argon2id

## Projektstruktur

```text
apps/
  api/       NestJS Backend
  web/       React Frontend
  desktop/   Electron-Verpackung (macOS/Windows, bündelt API + Web lokal)
packages/
  db/        MikroORM EntitySchemas, Migrations, Seed-Profile
  shared/    Zod-Schemas, Domain-Typen, reine Berechnungslogik
  pdf/       React-PDF Komponenten
  i18n/      Deutsche UI-Strings
```

## Setup (Development)

Voraussetzungen: Node 24.11+ (siehe `.nvmrc`), npm 11+

```bash
nvm use
npm install
npm run setup            # Build-Schritte freigeben (.npmrc setzt ignore-scripts)
cp .env.example .env     # Defaults reichen für lokale Entwicklung
npm run db:reset:demo    # Schema + Daten (:minimal | :demo | :local)
npm run dev              # Web :7272, API :7273
```

Login nach Demo-Seed: `demo@einfachvermieter.example` / `demo`.

Ohne Demo-Daten (`:minimal`) führt beim ersten Start ein Assistent durch das
Anlegen des Administrator-Kontos.

## Deployment

```bash
docker compose up -d
```

Der Container legt die Datenbank an und wendet Migrationen beim Start an. Beim
ersten Aufruf im Browser legt der Assistent das Administrator-Konto an.

### Desktop-App (Electron)

Alternative zum Docker-Betrieb für den Einzelplatz: eine installierbare
Desktop-App ohne Login (Daten liegen im Benutzerprofil, z. B.
`~/Library/Application Support/EinfachVermieter/data`).

```bash
npm run desktop        # Entwicklung: baut alles und startet die App
npm run desktop:dist   # Installer bauen (dmg/zip bzw. NSIS)
```

Status und Details: `docs/electron-todo.md` (Signierung/Auto-Update folgen).

## Tests

```bash
npm test
```

Die Berechnungsmodule in `packages/shared` (Umlageschlüssel, HeizkostenV,
CO2-Aufteilung, Differenzzähler, Zahlungszuordnung) sind unit-getestet,
inklusive End-to-End-Szenario über eine komplette Abrechnungsperiode.

## Lizenz

Proprietär, siehe [LICENSE](LICENSE). OSS später mal.
