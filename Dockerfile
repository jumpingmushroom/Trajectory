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
# better-sqlite3 ships glibc + musl prebuilt binaries but `prebuild-install`
# keeps fetching the glibc one in this build pipeline (the libc detector
# picks the wrong target), and `pnpm rebuild` re-runs the same install
# script (`prebuild-install || node-gyp rebuild`) which short-circuits to
# prebuild. So we go around pnpm: after the install, drop into the
# better-sqlite3 dir and run node-gyp directly to compile against alpine's
# musl headers. Result: a musl-linked .node binary that loads inside the
# container.
FROM base AS deps
RUN apk add --no-cache python3 make g++ file \
    && npm install -g node-gyp
COPY package.json pnpm-lock.yaml* .npmrc ./
# Install everything WITHOUT running install scripts, then rebuild
# better-sqlite3 from source so we get a musl-linked binary instead of
# the glibc prebuild that prebuild-install otherwise downloads. node-gyp's
# internal COPY step misbehaves with pnpm's hardlinked layout, so we
# overwrite Release/.node manually after the link step.
RUN pnpm install --frozen-lockfile=false --ignore-scripts \
    && BS3_DIR="$(pnpm -s exec node -p "require.resolve('better-sqlite3/package.json')" | xargs dirname)" \
    && echo "Rebuilding better-sqlite3 in: $BS3_DIR" \
    && cd "$BS3_DIR" \
    && rm -rf build \
    && node-gyp rebuild --release \
    && file build/Release/better_sqlite3.node | grep -q SYSV \
    && echo "verified: musl-linked better_sqlite3.node"

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
