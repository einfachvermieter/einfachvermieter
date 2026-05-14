# Multi-Stage Build fuer EinfachVermieter-App.
# Das Runtime-node_modules enthaelt nur die API-Workspace-Closure, nicht die
# Web-Frontend-Deps (Web wird als statisches dist ausgeliefert). PDF-Assets
# (tnum-Font, Logo) werden im Build erzeugt, nicht aus dem Repo erwartet.
#
# Stage 1: Build (volle Dev-Deps, baut API + Web)
# Node-Version muss zu engines/.nvmrc passen (>= 24.11).
FROM node:24-alpine AS builder

# python3/make/g++ fuer native Module; pyftfeatfreeze (opentype-feature-freezer)
# fuer den tnum-Font-Freeze der PDF-Assets. Dieser Stage wird verworfen -> kein
# Einfluss auf die finale Image-Groesse.
RUN apk add --no-cache python3 make g++ libc6-compat py3-pip \
    && pip install --break-system-packages --no-cache-dir opentype-feature-freezer

WORKDIR /app

# Lock und Manifeste zuerst fuer besseres Layer-Caching. .npmrc mitkopieren,
# damit ignore-scripts=true gilt (postinstall/freeze braucht den Quellbaum, der
# erst nach npm ci kommt).
COPY package.json package-lock.json turbo.json tsconfig.base.json .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/pdf/package.json ./packages/pdf/
COPY packages/i18n/package.json ./packages/i18n/

RUN npm ci

COPY . .
# Native-Module bauen + PDF-Assets on the fly erzeugen (Font-tnum-Freeze und
# Logo mit oklch->rgb). Beide Assets sind bewusst nicht im Repo/Build-Kontext.
RUN npm run setup
RUN npm run build

# Stage 2: Produktions-Dependencies - nur die API-Workspace-Closure.
# Eigener Install statt Prune, damit Web-exklusive Deps (date-fns, @tanstack,
# react-dom, react-day-picker, libphonenumber-js ...) gar nicht erst landen.
FROM node:24-alpine AS prod-deps

RUN apk add --no-cache python3 make g++ libc6-compat

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/pdf/package.json ./packages/pdf/
COPY packages/i18n/package.json ./packages/i18n/

RUN npm ci --omit=dev --workspace=apps/api --include-workspace-root
RUN npm_config_ignore_scripts=false npm rebuild libsql argon2

# Stage 3: Runtime
FROM node:24-alpine AS runtime

RUN apk add --no-cache libc6-compat sqlite su-exec

WORKDIR /app

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist
# Nur dist + package.json + Assets der Packages (kein src)
COPY --from=builder /app/packages/db/package.json ./packages/db/
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/pdf/package.json ./packages/pdf/
COPY --from=builder /app/packages/pdf/dist ./packages/pdf/dist
COPY --from=builder /app/packages/pdf/assets ./packages/pdf/assets
COPY --from=builder /app/packages/i18n/package.json ./packages/i18n/
COPY --from=builder /app/packages/i18n/dist ./packages/i18n/dist
COPY --from=prod-deps /app/node_modules ./node_modules
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && chown -R node:node /app

ENV NODE_ENV=production
# Wurzel fuer alle volatilen Daten: SQLite-DB (Default), Uploads und erstellte
# Abrechnungen. Als Volume mounten. Fuer Postgres/MariaDB stattdessen DB_DRIVER
# + DATABASE_URL setzen (DATA_DIR wird dann nur noch fuer Uploads/PDFs genutzt).
ENV DATA_DIR=/data
ENV PORT=3000

EXPOSE 3000

# Einziges Daten-Volume (DB falls sqlite, uploads/, statements/)
VOLUME ["/data"]

# Berechtigungen für /data Entrypoint setzen
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Default-Command: API starten. Das Web-Build wird von der API als Static
# ausgeliefert oder von einem vorgelagerten Reverse Proxy (Caddy, Traefik).
CMD ["node", "apps/api/dist/main.js"]
