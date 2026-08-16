# EinfachVermieter

Software für private Vermieter: Immobilien, Mieter, Verträge, Zählerstände und
Betriebskosten verwalten und daraus Nebenkostenabrechnungen als PDF erstellen.

## Funktionsumfang

- Gebäude, Wohnungen und Mieter verwalten
- Zahlungseingänge den Mieten und Nebenkosten-Vorauszahlungen zuordnen
- Zählerstände: Wasser (mit Differenzzähler-Logik), Strom, Gas, Heizkostenverteiler
- Betriebskosten mit verschiedenen Umlageschlüsseln (qm, Personen, pro Wohnung,
  Verbrauch, HeizkostenV, fest)
- Abrechnungen mit Live-PDF-Vorschau, finalisierbar und unveränderlich
  (inkl. Storno-/Korrektur-Workflow)
- Heizkosten nach HeizkostenV inkl. Warmwasser-Abspaltung und CO2-Kostenaufteilung
- Optionales KI-Vorausfüllen von Lieferantenrechnungen (Mistral, OpenAI, Anthropic, Gemini oder lokal per Ollama)

## Bekannte Grenzen

- **Nur Wohnraumvermietung.** Eine gewerbliche Vermietung wäre für dieses Projekt
  viel zu aufwändig: Brutto, Netto, Steuerausweis, andere Fristen, andere
  CO2-Verteilungen bei Heizkosten, etc.
- **Ersatzverfahren nach § 9a HeizkostenV nur als Flächen-Fallback.** Fällt die
  Verbrauchserfassung aus, verteilt die App die betroffenen Kosten nach Fläche und
  weist das in der Abrechnung samt Hinweis auf das Kürzungsrecht aus. Der vom
  Gesetz vorgesehene Ersatzwert aus einem Vergleichszeitraum oder aus vergleichbaren
  Räumen ist nicht geführt umgesetzt, ebenso wenig die 25-%-Grenze. Geschätzte
  Ablesungen lassen sich von Hand erfassen; sie werden im PDF ausgewiesen.
- **Keine unterjährige Verbrauchsinformation nach § 6a Abs. 1 und 2 HeizkostenV.**
  Bei fernablesbaren Geräten sind Mieter monatlich über ihren Verbrauch zu
  informieren. Die App erzeugt und versendet diese Mitteilungen nicht; sie deckt
  nur die Jahresabrechnung ab.

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

Voraussetzungen: Node 24.11+ (siehe `.nvmrc`), npm 11+,
pyftfeatfreeze (`pip install opentype-feature-freezer`)

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

### Passwort vergessen

Es gibt keinen Versand von Wiederherstellungs-Links (die App verschickt keine
E-Mails). Stattdessen tragen Sie in die Umgebungsvariable `PASSWORD_RESET` einen
selbst gewählten Code ein (in `docker-compose.yml` schon als Kommentar
vorbereitet) und starten den Container neu:

```yaml
- PASSWORD_RESET=GeheimesKennwort!1234
```

Er läuft dann im Rücksetz-Modus: Der Browser zeigt nur noch ein Formular für ein
neues Passwort, alles andere ist gesperrt. Im Formular wählen Sie das Konto,
geben denselben Code ein und vergeben das neue Passwort. Danach entfernen Sie
die Variable wieder und starten erneut neu, dann ist die Anmeldung mit dem
neuen Passwort möglich. Alle angemeldeten Benutzer müssen sich neu anmelden.

Der Code sorgt dafür, dass nicht jeder, der in diesem Zeitfenster die Adresse
im Browser aufruft, das Passwort setzen kann. Nehmen Sie deshalb keinen kurzen
Wert wie `1`, sondern etwas Zufälliges. Pro Start ist genau ein Zurücksetzen
möglich, danach ist auch mit richtigem Code Schluss. Lassen Sie die Variable
trotzdem nicht dauerhaft gesetzt.

### Desktop-App (Electron)

Alternative zum Docker-Betrieb für den Einzelplatz: eine installierbare
Desktop-App ohne Login (Daten liegen im Benutzerprofil, z. B.
`~/Library/Application Support/EinfachVermieter/data`).

```bash
npm run desktop        # Entwicklung: baut alles und startet die App
npm run desktop:dist   # Installer bauen (dmg/zip bzw. NSIS)
```

Status und Details: `docs/desktop.md` (Signierung/Auto-Update folgen).

## Tests

```bash
npm test
```

Die Berechnungsmodule in `packages/shared` (Umlageschlüssel, HeizkostenV,
CO2-Aufteilung, Differenzzähler, Zahlungszuordnung) sind unit-getestet,
inklusive End-to-End-Szenario über eine komplette Abrechnungsperiode.

## Hintergrund

2022 haben wir ein Haus in der Familie übernommen und saniert, ein Teil davon
ist vermietet. Einmal im Jahr steht seitdem eine Nebenkostenabrechnung an,
inklusive HeizkostenV, CO2-Kostenaufteilung, etc.

Eine Excel-Tabelle war mir zu unflexibel und die Softwares am Markt nicht das,
was ich mir vorgestellt hatte oder zu teuer. Also habe ich mich als Programmierer
selbst an die Sache gemacht.

Auch wenn die Software primär den Bedarf in unserem eigenen Haus abdeckt, habe
ich inzwischen, auch dank der Unterstützung von KI, etliche Fälle und Varianten
der Vermietung abgedeckt, die über unser privates Haus hinausgehen.

## Lizenz

Proprietär, siehe [LICENSE](LICENSE). OSS später mal.
