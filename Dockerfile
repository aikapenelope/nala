# Nova API + Web - Multi-stage Dockerfile for Coolify deployment.
#
# Builds both the API (Hono) and Web (Nuxt SSR) in a single image.
# On startup, runs drizzle-kit migrate for versioned migrations + init.sql for RLS.
#
# Build args:
#   NUXT_PUBLIC_API_BASE - API URL for the frontend (e.g. https://nova-api.aikalabs.cc)
#   NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY - Clerk publishable key
#
# Usage in Coolify:
#   - API service: target stage "api", port 3001
#   - Web service: target stage "web", port 3000

ARG NODE_VERSION=22-slim

# ============================================
# Stage 1: Install dependencies
# ============================================
FROM node:${NODE_VERSION} AS deps

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates curl python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/

# Use npm ci to install exact versions from lockfile.
# This preserves @clerk/* version consistency between build and runtime.
# Native binaries (esbuild, etc.) are resolved for linux automatically by npm ci.
RUN npm ci --no-audit --no-fund

# ============================================
# Stage 2: Build all packages
# ============================================
FROM node:${NODE_VERSION} AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Restore workspace symlinks
RUN npm install --no-audit --no-fund

# Build shared packages first, then apps
RUN npx turbo build --filter=@nova/shared --filter=@nova/db
RUN npx turbo build --filter=@nova/api

# Build web with public env vars baked in
ARG NUXT_PUBLIC_API_BASE
ARG NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY

ENV NUXT_PUBLIC_API_BASE=$NUXT_PUBLIC_API_BASE
ENV NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY

RUN npx turbo build --filter=@nova/web

# ============================================
# Stage 3: API production image
# ============================================
FROM node:${NODE_VERSION} AS api

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates curl postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Copy bundled API (single file from tsup) + external dependencies
COPY --from=builder --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=node:node /app/apps/api/package.json ./apps/api/
COPY --from=builder --chown=node:node /app/packages/db/src/schema.ts ./packages/db/src/schema.ts
COPY --from=builder --chown=node:node /app/packages/db/drizzle.config.ts ./packages/db/drizzle.config.ts
COPY --from=builder --chown=node:node /app/packages/db/drizzle ./packages/db/drizzle
COPY --from=builder --chown=node:node /app/packages/db/init.sql ./packages/db/init.sql
COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules

# Entrypoint: sync schema + apply RLS + start server
COPY --chown=node:node entrypoint-api.sh ./entrypoint-api.sh
RUN chmod +x entrypoint-api.sh

USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://127.0.0.1:3001/health || exit 1

CMD ["./entrypoint-api.sh"]

# ============================================
# Stage 4: Web production image (Nuxt SSR)
# ============================================
FROM node:${NODE_VERSION} AS web

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder --chown=node:node /app/apps/web/.output ./.output

# Nitro's index.mjs imports @clerk/shared runtime files as external modules.
# Copy the exact same @clerk packages that were used during the build.
# The rm ensures no partial files from Nitro conflict with the COPY.
# Nitro externalizes @clerk/shared runtime files. The web needs @clerk/shared@4.x
# (from @clerk/nuxt) but the top-level node_modules has @clerk/shared@3.x (from
# @clerk/backend in the API). Copy the correct 4.x version from the nested location.
RUN rm -rf ./.output/server/node_modules/@clerk/shared
COPY --from=builder /app/node_modules/@clerk/nuxt/node_modules/@clerk/shared ./.output/server/node_modules/@clerk/shared

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>{if(!r.ok)throw r.status}).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
