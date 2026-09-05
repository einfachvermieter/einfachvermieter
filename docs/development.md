# Development

## Voraussetzungen

- **Node 24.11+** (siehe `.nvmrc`)
- **npm 11+**
- macOS / Linux (libsql/argon2 bauen nativ; Windows nicht getestet)
- **pyftfeatfreeze** (`pip install opentype-feature-freezer`), sonst bricht
  `npm run setup` beim PDF-Font-Schritt ab

```bash
nvm use        # respektiert .nvmrc
npm install
npm run setup  # native Module (libsql, argon2) + PDF-Assets
               # (.npmrc setzt ignore-scripts=true, daher nötig)
```

## Erstes Setup

```bash
cp .env.example .env   # Defaults reichen für lokale Entwicklung

npm run db:reset:demo  # Schema anlegen + breiter Demo-Datenbestand
npm run dev            # Web auf :7272, API auf :7273
```

Login (Demo-Seed): `demo@einfachvermieter.example` / `demo`.

Seed-Profile (jeweils auch als `db:reset:<profil>` = wipe + schema:fresh + seed):

- `db:seed:minimal`: nur AppSettings, bewusst **kein** User. Der Erststart führt durch den Einrichtungs-Assistenten (`/einrichtung`).
- `db:seed:demo`: mehrere Gebäude mit unterschiedlichen Heizungsarten, Belegen, Mieterwechsel.
- `db:seed:local`: lokale Testdaten, die **nicht eingecheckt** werden sollen (`packages/db/scripts/seed/local.ts`).

## Wichtige Skripte (root `package.json`)

| Script | Wirkung |
| --- | --- |
| `npm run dev` | Turborepo startet API + Web parallel (persistent) |
| `npm run build` | Vollständiger Production-Build aller Workspaces |
| `npm test` | Vitest in allen Workspaces |
| `npm run check` | Biome (Lint + Format, nur prüfen) |
| `npm run check:fix` | Biome `check --write` (Lint + Format anwenden) |
| `npm run typecheck` | TypeScript-Typprüfung in allen Workspaces (via Turborepo) |
| `npm run desktop` | Build, dann die Desktop-App (Electron) lokal starten |
| `npm run desktop:dist` | Build, dann die Installer für macOS und Windows bauen |
| `npm run db:generate` | MikroORM-Migration aus den Entities erzeugen (je Dialekt unter `packages/db/src/migrations/<dialect>/`) |
| `npm run db:push` | `schema:fresh`: Schema **Drop + Create** ohne Migration (nur Dev!) |
| `npm run db:migrate` | Migrationen einspielen |
| `npm run db:wipe` | DB + Uploads löschen, dann `db:push` (ohne Seed) |
| `npm run db:seed:minimal\|demo\|local` | Jeweiliges Seed-Profil laufen lassen |
| `npm run db:reset:minimal\|demo\|local` | `db:wipe` + jeweiliges Seed-Profil |

> **Migrationen:** In der Entwicklung reicht `db:push`. Versioniert werden
> Migrationen nur für den Produktivbetrieb, mit `db:generate`. Lokal ist
> `db:reset:<profil>` der schnelle Weg, Schema-Änderungen aufzunehmen.

## Workspace-Skripte

```bash
# Backend
npm run dev   -w @einfachvermieter/api    # nest start --watch
npm run build -w @einfachvermieter/api    # nest build
npm test      -w @einfachvermieter/api

# Frontend
npm run dev   -w @einfachvermieter/web    # vite
npm run build -w @einfachvermieter/web    # tsc -b && vite build

# Geteilte Bibliothek
npm test           -w @einfachvermieter/shared
npm run test:watch -w @einfachvermieter/shared
```

## Ports

| Komponente | ENV | Default |
| --- | --- | --- |
| API | `PORT` | 7273 |
| Web (Vite) | `WEB_PORT` | 7272 |
| CORS-Origin | `WEB_ORIGIN` | `http://localhost:7272` |

Nach jeder größeren Änderung prüfen, ob beide Ports noch antworten.

## Weitere ENV-Variablen

Vollständige Referenz mit Kommentaren: `.env.example`. Die wichtigsten:

| ENV | Wirkung | Default |
| --- | --- | --- |
| `DATA_DIR` | Wurzel für DB, Uploads und Abrechnungs-PDFs | `./data` (Container: `/data`) |
| `SESSION_TTL_DAYS` | Lebensdauer der Login-Session | 7 |
| `MAX_ATTACHMENT_MB` / `MAX_LOGO_MB` | Upload-Limits für Belege bzw. Logo | 20 / 2 |
| `PASSWORD_MIN_LENGTH`, `PASSWORD_REQUIRE_{UPPERCASE,LOWERCASE,DIGIT,SPECIAL}` | Passwort-Richtlinie für Einrichtung und Passwortwechsel | 8, alle Flags `false` |

## Tests

```bash
npm test                                   # alle Workspaces
npm run test -w @einfachvermieter/shared   # nur Berechnungen
```

Die Berechnungsschicht (`packages/shared/src/calculations/*.test.ts` +
`e2e.test.ts`) ist breit getestet, inklusive des kompletten
NK-Abrechnungs-Szenarios. Wenn Berechnungen geändert werden, **immer** mit
`npm test` validieren.

Zusätzlich fährt `apps/api/test/happy-path.e2e.test.ts` die komplette
App gegen eine Wegwerf-SQLite hoch und testet den Happy Path über
echtes HTTP (Login -> Stammdaten -> Abrechnung -> Finalize -> PDF ->
Mieterkonto -> Storno). Läuft in `npm test` mit; einzeln:
`npx vitest run test/happy-path.e2e.test.ts` in `apps/api`.

## Optionale Features

### KI-gestützte Rechnungs-Vorbefüllung

Belege können per Texterkennung ausgelesen und als Rechnungsentwurf
vorbefüllt werden. Die Zugangsdaten werden bevorzugt in der App unter
*Einstellungen / KI-Anbieter* hinterlegt. Damit sie nicht nach jedem
Datenbank-Reset neu eingetragen werden müssen, gehen sie in der
Entwicklung auch über die `.env`:

```env
AI_PROVIDER=mistral        # mistral | openai | anthropic | gemini | ollama
AI_API_KEY_MISTRAL=…       # Suffix = Anbieter in Großbuchstaben
```

Optional je Anbieter: `AI_MODEL_<ANBIETER>` und `AI_BASE_URL_<ANBIETER>`.
Ohne Key bleibt die Funktion inaktiv, Uploads funktionieren weiter,
nur ohne Vorschlag. `AI_DEBUG=true` schreibt alle Anfragen und Antworten
neben den Upload; die Dumps enthalten den Volltext der Belege, also nur
lokal einschalten.

## Häufige Probleme

| Symptom | Ursache / Lösung |
| --- | --- |
| `libsql`/`argon2` lädt nicht (Native-Binding fehlt) | `.npmrc` hat `ignore-scripts=true`, deshalb `npm run setup` bzw. `npm run rebuild:native` ausführen |
| Vite Port belegt | `WEB_PORT` ändern oder den Halter beenden |
| 401 nach Login | Cookie-Domain / Same-Site: `WEB_ORIGIN` und Frontend müssen exakt übereinstimmen (Schema + Host + Port) |
| `db:push` hängt | Die SQLite-Datei ist durch den laufenden Dev-Server gelockt. Erst stoppen, dann `db:reset:<profil>` |
