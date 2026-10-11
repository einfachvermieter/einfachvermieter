# Installation mit Docker

Das Image `einfachvermieter/einfachvermieter` bringt alles mit, was die App
braucht. Der Container ist per HTTP auf Port 7273 erreichbar. Eine externe
Datenbank ist möglich (MariaDB ab 10.11 oder PostgreSQL), aber nicht nötig.
MySQL wird nicht unterstützt.

## Den Container starten

### docker-compose.yml

```yaml
services:
  app:
    image: einfachvermieter/einfachvermieter:latest
    container_name: einfachvermieter
    restart: unless-stopped
    ports:
      - "7273:7273"
    environment:
      - TZ=Europe/Berlin
      # - PUID=1000
      # - PGID=1000
      # - TRUST_PROXY=1
    volumes:
      - ./data:/data
```

### docker run

```bash
docker run -d --name einfachvermieter --restart unless-stopped \
  -p 7273:7273 -e TZ=Europe/Berlin \
  -v /srv/einfachvermieter:/data \
  einfachvermieter/einfachvermieter:latest
```

## Erster Start

Sobald der Container läuft, öffnen Sie die App im Browser. Der
Einrichtungs-Assistent legt den Admin-Zugang an und fragt die
wichtigsten Einstellungen ab.

## Konfiguration

| ENV | Beschreibung |
| --- | --- |
| `TZ` | Zeitzone, z. B. `Europe/Berlin` |
| `PUID`, `PGID` | Benutzer und Gruppe, denen die Dateien unter `/data` gehören. Ohne Angabe läuft die App als eingebauter Benutzer `node` (UID/GID 1000). `PGID` ohne Angabe gleich `PUID` |
| `TRUST_PROXY` | Anzahl vertrauenswürdiger Proxy-Hops, hinter einem Reverse-Proxy `1`. Ohne Proxy leer lassen, sonst bestimmt jeder Client seine IP fürs Rate-Limit selbst |
| `SESSION_TTL_DAYS` | Lebensdauer der serverseitigen Session, Default 7 Tage |
| `PASSWORD_MIN_LENGTH`, `PASSWORD_REQUIRE_{UPPERCASE,LOWERCASE,DIGIT,SPECIAL}` | Passwort-Richtlinie, Default 8 Zeichen ohne weitere Anforderungen |
| `MAX_ATTACHMENT_MB`, `MAX_LOGO_MB` | Upload-Limits, Default 20 und 2 |
| `DB_DRIVER`, `DATABASE_URL` | `postgres` oder `mariadb` statt SQLite. Ohne `DB_DRIVER` entscheidet das Schema der URL (`postgres://` oder `mariadb://`). Die alte Schreibweise `mysql` gilt weiter und meint MariaDB |
| `PASSWORD_RESET` | Passwort eines Kontos zurücksetzen: Code eintragen, neu starten, in der App zurücksetzen, Variable wieder entfernen. Solange sie gesetzt ist, ist die App gesperrt |

## Aktualisieren

1. Sicherung anlegen (siehe [Backup](#backup)). Beim Start übernimmt die neue Version
   ausstehende Schema-Änderungen. Die interne SQLite-Datenbank sichert die
   App davor selbst nach `/data/backups`. Einen eigenen Datenbank-Server
   sichern Sie vorher selbst; ohne diese Sicherung gibt es dort keinen Weg
   zurück.
2. Neues Image holen und den Container neu starten:

   ```bash
   docker compose pull
   docker compose up -d
   ```

Ein Wechsel auf eine **ältere** Version wird nicht unterstützt.

### Wenn die Aktualisierung fehlschlägt

Scheitert die Umstellung der Datenbank, startet die App gesperrt und zeigt
die Seite „Aktualisierung fehlgeschlagen“. Die Seite nennt die Versionen,
die Sicherung und den Weg zurück. Die Fehlermeldung der Datenbank steht in
`docker logs` und in `/data/api.log`. Ein neuer Versuch findet erst beim
nächsten Start des Containers statt.

| Datenbank | Die Seite meldet | Weg zurück |
| --- | --- | --- |
| SQLite, PostgreSQL | Aktualisierung wurde abgebrochen | Das vorige Image starten. Die Datenbank ist auf dem Stand von vorher. |
| SQLite | Zustand nicht feststellbar | Container stoppen, die Sicherung aus `/data/backups` an die Stelle von `einfachvermieter.db` kopieren, die Dateien `einfachvermieter.db-wal` und `-shm` entfernen, dann das vorige Image starten. |
| PostgreSQL, MariaDB | Zustand nicht feststellbar | Ihre Sicherung von vor der Aktualisierung zurückspielen, dann das vorige Image starten. |

Scheitert schon die erste Einrichtung einer leeren Datenbank, heißt die
Seite „Einrichtung fehlgeschlagen“. Es muss nichts zurückgerollt werden. Bei
MariaDB kann ein Teil der Tabellen stehen bleiben: Legen Sie die Datenbank
neu an, bevor Sie den Container wieder starten. Meldet die Seite, dass sich
der Zustand der Datenbank nicht sicher feststellen lässt, enthält sie schon
Tabellen: Löschen Sie nichts, solange nicht feststeht, dass keine Daten
darin liegen.

Bei MariaDB ist der Zustand nach einem Abbruch nie feststellbar, weil
MariaDB Schema-Änderungen nicht zurücknimmt. **Starten Sie das vorige Image
dort nie ohne zurückgespielte Sicherung:** Es erkennt eine halb umgestellte
Datenbank nicht und arbeitet damit weiter.

Fallen falsch übernommene Werte erst später auf, hilft nur die Sicherung
von vor der Aktualisierung.

## Backup

### Dateien

Die dynamisch erstellten Dateien, also Uploads und Abrechnungen, liegen im Verzeichnis `/data`.

Der Container setzt beim Start die Rechte auf `/data` selbst. Sollen die Dateien
auf dem Host einem bestimmten Benutzer gehören, etwa damit ein NAS-Backup sie
lesen darf, setzen Sie `PUID` und `PGID` auf dessen IDs (`id -u` und `id -g`
auf dem Host).

### Datenbank

Vor jeder Aktualisierung, die die Datenbank umstellt, legt die App selbst
eine Kopie der SQLite-Datenbank unter
`/data/backups/<Version>-<Datum>-<Uhrzeit>.db` an. Alte Kopien räumt sie
nicht auf. Das ersetzt Ihre regelmäßige Sicherung nicht.

Die interne SQLite-Datenbank liegt ebenfalls unter `/data`. Stoppen Sie den
Container, bevor Sie sie kopieren, sonst erwischen Sie sie mitten im
Schreiben. Sichern Sie `einfachvermieter.db`, `einfachvermieter.db-wal` und
`einfachvermieter.db-shm`, oder nutzen Sie vorab den SQLite-Befehl
`.backup`.

Wenn Sie einen eigenen Datenbank-Server verwenden, sichern Sie die
Datenbank dort.

## Reverse-Proxy

Die App bringt kein TLS mit und erwartet für den Zugriff von außen einen
Proxy davor. Mit `TRUST_PROXY=1` wertet sie `X-Forwarded-For` und
`-Proto` aus, womit das Rate-Limit die echte Client-IP sieht und das
Session-Cookie sein Secure-Flag bekommt. Als Healthcheck-Ziel dient
`GET /api/health`. Er antwortet mit 200, solange die App läuft, auch wenn
sie gesperrt ist; im Rumpf steht dann `"status": "locked"` statt `"ok"`.

Setzen Sie im Reverse-Proxy dieselben Upload-Limits wie in
`MAX_ATTACHMENT_MB` und `MAX_LOGO_MB`, sonst schlagen große Uploads
schon vor der App fehl.
