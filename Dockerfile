# syntax=docker/dockerfile:1

# ── base ──────────────────────────────────────────────────────────────────────
# Debian slim so the Prisma query engine (native binary) is identical across the
# builder and runner stages — no binaryTargets juggling.
FROM node:22-bookworm-slim AS base
WORKDIR /app
# Prisma's query engine dynamically links OpenSSL at runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1

# ── deps ──────────────────────────────────────────────────────────────────────
# Install node_modules once; reused by every later stage.
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ── dev ───────────────────────────────────────────────────────────────────────
# Target for docker-compose.yml. The repo is bind-mounted over /app at runtime;
# node_modules and .next are anonymous volumes seeded from this image. Runs as
# the non-root `node` user (uid 1000) so files it writes into the bind mount
# (e.g. next-env.d.ts) are owned by the host user instead of root. Compose
# overrides CMD to run `prisma generate && prisma db push && next dev`.
FROM base AS dev
ENV NODE_ENV=development
# Own the dirs backing the anonymous volumes so the non-root user can write them
# (prisma generate → node_modules/.prisma, next dev → .next).
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
RUN mkdir -p /app/.next && chown node:node /app/.next
USER node
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ── builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
# Placeholder so any module-load-time PrismaClient()/env read during the build
# doesn't trip on a missing var. The build never connects to a database.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
# NEXT_PUBLIC_* is inlined at build time — pass the real URL for production builds.
ARG NEXT_PUBLIC_APP_URL="http://localhost:3000"
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ── runner ────────────────────────────────────────────────────────────────────
# Minimal production image: Next standalone server + traced deps only.
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
# Bind to all interfaces so the published port is reachable.
ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
# Insurance: Next's output tracing can miss Prisma's generated client + engine
# binary (node_modules/.prisma). Copy it explicitly.
COPY --from=builder --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma

USER node
EXPOSE 3000
CMD ["node", "server.js"]
