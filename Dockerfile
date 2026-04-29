# Trajectory — multi-stage build.
# `dev` target runs Vite with HMR + bind-mounted source.
# `prod` target builds a static node server bundle.

ARG NODE_VERSION=22-alpine

# ─── base ──────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache tini

# ─── deps (cached install layer) ───────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml* .npmrc ./
RUN pnpm install --frozen-lockfile=false

# ─── dev ───────────────────────────────────────────────────────────────
# Used by docker-compose for local development.
# Source tree is bind-mounted from the host; node_modules lives in an
# anonymous volume so the host's (possibly absent) node_modules doesn't
# shadow the container's installed deps.
FROM base AS dev
ENV NODE_ENV=development \
    HOST=0.0.0.0 \
    PORT=5173 \
    CHOKIDAR_USEPOLLING=true \
    CHOKIDAR_INTERVAL=200
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 5173
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["pnpm", "run", "dev"]

# ─── build (intermediate for prod) ─────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

# ─── prod ──────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS prod
WORKDIR /app
RUN apk add --no-cache tini
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "build"]
