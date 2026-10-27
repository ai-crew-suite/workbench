ARG NODE_VERSION=22-bookworm-slim
FROM node:${NODE_VERSION}

WORKDIR /app

# hadolint ignore=DL3008
RUN apt-get update && \
    apt-get install -y --no-install-recommends tini && \
    rm -rf /var/lib/apt/lists/* && \
    corepack enable

# Root matches root-mapped bind-mount owners in writable development environments.
# hadolint ignore=DL3002
USER 0

ENV NODE_ENV=development
ENV NODE_OPTIONS="--no-node-snapshot"

EXPOSE 7007

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["yarn", "start"]
