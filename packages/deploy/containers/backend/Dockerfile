# --------------------------------------------------------------------
# Stage 1: Build the Workbench Runner Core
# --------------------------------------------------------------------

ARG NODE_VERSION=22-bookworm-slim
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

# Accept the unique skeleton directory name from the shell script
ARG SKELETON_DIR

# hadolint ignore=DL3008
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 g++ make && \
    rm -rf /var/lib/apt/lists/*

# 1. Copy the target-specific structural skeleton configuration maps
COPY ${SKELETON_DIR}/ ./

# 2. Focus dependencies safely
RUN yarn workspaces focus @ai-crew-suite/workbench-backend

# 3. Pull in the real source directories needed to perform the compilation step
COPY packages/cli/ ./packages/cli/
COPY packages/fixtures/ ./packages/fixtures/
COPY packages/wiremock/ ./packages/wiremock/
COPY packages/backstage/backend/ ./packages/backstage/backend/

# Execute compilation and purge caches
RUN yarn workspace @ai-crew-suite/workbench-backend build && \
    yarn cache clean

# --------------------------------------------------------------------
# Stage 2: Lean High-Security Runtime (The Base Image)
# --------------------------------------------------------------------

FROM node:${NODE_VERSION} AS runtime
WORKDIR /app

# hadolint ignore=DL3008
RUN apt-get update && \
    apt-get install -y --no-install-recommends tini && \
    rm -rf /var/lib/apt/lists/* && \
    mkdir -p /app/external-plugins && \
    chown -R node:node /app/external-plugins

USER 1000

COPY --chown=node:node --from=builder /app/package.json /app/yarn.lock /app/.yarnrc.yml ./
COPY --chown=node:node --from=builder /app/.yarn/ .yarn/
COPY --chown=node:node --from=builder /app/node_modules/ node_modules/
COPY --chown=node:node --from=builder /app/packages/backstage/backend/package.json ./packages/backstage/backend/package.json
COPY --chown=node:node --from=builder /app/packages/backstage/backend/dist/ ./packages/backstage/backend/dist/

ENV NODE_ENV=production
ENV NODE_OPTIONS="--no-node-snapshot"

EXPOSE 7007

ENTRYPOINT ["/usr/bin/tini", "--"]

CMD ["node", "packages/backstage/backend/dist/index.js", "--config", "packages/backstage/backend/skeleton/empty-fallback.yaml"]
