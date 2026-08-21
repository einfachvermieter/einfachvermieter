# Stage 1: Build (API + Web). Node-Version wie .nvmrc.
FROM node:24.11.0-alpine AS builder

# python3/make/g++ fuer native Module, opentype-feature-freezer fuer den
# tnum-Font der PDF-Assets.
RUN apk add --no-cache python3 make g++ libc6-compat py3-pip \
    && pip install --break-system-packages --no-cache-dir opentype-feature-freezer

WORKDIR /app

COPY package.json package-lock.json turbo.json tsconfig.base.json .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/pdf/package.json ./packages/pdf/
COPY packages/i18n/package.json ./packages/i18n/

RUN npm ci

COPY . .
# Native-Module bauen + PDF-Assets erzeugen (nicht im Repo).
RUN npm run setup
RUN npm run build

# Stage 2: Produktions-Dependencies, nur die API-Closure (keine Web-Deps).
FROM node:24.11.0-alpine AS prod-deps

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
FROM node:24.11.0-alpine AS runtime

RUN apk add --no-cache libc6-compat sqlite su-exec

WORKDIR /app

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist
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
# SQLite-DB, Uploads und Abrechnungs-PDFs. Als Volume mounten.
ENV DATA_DIR=/data
ENV PORT=7273

EXPOSE 7273
VOLUME ["/data"]

# Setzt Rechte auf /data und startet als User node.
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "apps/api/dist/main.js"]
