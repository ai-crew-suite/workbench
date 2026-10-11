# ====================================================================================
#   Monolithic, production-ready environment orchestrator
# ====================================================================================

# --- STAGE 1: SYSTEM PREPARATION & CORREPACK ISOLATION ---
FROM node:22-bookworm-slim AS skeleton
WORKDIR /app

# Install explicit system dependencies required for building native bindings (node-gyp/esbuild)
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 g++ make tini && \
    rm -rf /var/lib/apt/lists/*

# Copy workspace structural files to evaluate the dependency tree skeleton
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases/ .yarn/releases/
COPY .yarn/plugins/ .yarn/plugins/

# 🎯 THE FIX: Copy every single workspace package descriptor to satisfy lockfile bounds
COPY packages/app-config/package.json packages/app-config/package.json
COPY packages/backend/package.json packages/backend/package.json
COPY packages/containers/package.json packages/containers/package.json
COPY packages/deploy-kubernetes/package.json packages/deploy-kubernetes/package.json
COPY packages/deploy-terraform/package.json packages/deploy-terraform/package.json
COPY packages/mock-service/package.json packages/mock-service/package.json

# --- STAGE 2: IMMUTABLE COMPILATION & BUNDLING ---
FROM skeleton AS build

# Inject configuration dependencies and compile our packages into executable artifacts
RUN yarn install --immutable

COPY packages/app-config/ packages/app-config/
COPY packages/backend/ packages/backend/

COPY packages/mock-service/ packages/mock-service/

COPY turbo.json ./

RUN yarn compile

# --- STAGE 3: THE HIGH-SECURITY LEAN RUNTIME ---
FROM node:24-bookworm-slim AS runtime
WORKDIR /app

# Enforce secure system defaults (never execute container tracking hooks as root user)
USER node

# Copy execution environments, runtime assets, and static mock fixtures cleanly
COPY --chown=node:node --from=build /app/package.json /app/yarn.lock /app/.yarnrc.yml ./
COPY --chown=node:node --from=build /app/.yarn/ .yarn/
COPY --chown=node:node --from=build /app/packages/app-config/app-config.ci.yaml ./app-config.yaml
COPY --chown=node:node --from=build /app/packages/backend/dist/ packages/backend/dist/
COPY --chown=node:node --from=build /app/packages/backend/package.json packages/backend/package.json
COPY --chown=node:node --from=build /app/node_modules/ node_modules/

# Set production execution flags
ENV NODE_ENV=production
# 🎯 Critical for Scaffolder runtime stability on Node 20+
ENV NODE_OPTIONS="--no-node-snapshot"

# Expose our modern backend routing boundary port
EXPOSE 7007

# Utilize tini as init to handle system interrupt loops and child process signals correctly
ENTRYPOINT ["/usr/bin/tini", "--"]

CMD ["node", "packages/backend/dist/index.js", "--config", "app-config.yaml"]
