# --------------------------------------------------------------------
# Stage 1: Build the Workbench App Shell (Caching Layer)
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
RUN yarn workspaces focus @ai-crew-suite/workbench-app

# 3. Pull in the real source directories needed to perform the compilation step
COPY packages/backstage/app/ ./packages/backstage/app/

RUN yarn cache clean

# --------------------------------------------------------------------
# Stage 2: Production Compilation Shell (The Target Base Image)
# --------------------------------------------------------------------

FROM builder AS compiler
WORKDIR /app

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"

RUN mkdir -p /app/external-plugin-src

CMD ["yarn", "workspace", "@ai-crew-suite/workbench-app", "build"]
