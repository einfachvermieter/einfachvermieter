#!/bin/sh
set -e
# /data ist ein gemountetes Volume; Ownership beim Start auf den Ziel-Benutzer
# setzen, dann Privilegien fallen lassen -> der Node-Prozess laeuft
# unprivilegiert. Ohne PUID/PGID bleibt es beim eingebauten User node (1000).
PUID="${PUID:-node}"
PGID="${PGID:-$PUID}"
chown -R "$PUID:$PGID" /data 2>/dev/null || true
exec su-exec "$PUID:$PGID" "$@"
