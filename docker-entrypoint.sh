#!/bin/sh
set -e
# /data ist ein gemountetes Volume; Ownership beim Start auf node (UID 1000)
# dann Privilegien fallen lassen -> der Node-Prozess laeuft unprivilegiert.
chown -R node:node /data 2>/dev/null || true
exec su-exec node "$@"
