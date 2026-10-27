# ==========================================
# STAGE 1: Compile Native Go Cluster Engine
# ==========================================
FROM golang:1.27-alpine AS builder

# hadolint ignore=DL3018
RUN apk add --no-cache git make bash gcc musl-dev

ARG GIT_HOST=github.com
ARG ORG_NAME=temporalio
ARG PROJECT_NAME=temporal
ARG ENGINE_VERSION=v1.24.2

WORKDIR /go/src/${GIT_HOST}/${ORG_NAME}/${PROJECT_NAME}
WORKDIR /go/src/${GIT_HOST}/${ORG_NAME}/${PROJECT_NAME}

RUN git clone --depth 1 --branch ${ENGINE_VERSION} https://${GIT_HOST}/${ORG_NAME}/${PROJECT_NAME}.git . \
    && make temporal-server temporal-sql-tool

# ==========================================
# STAGE 2: Construct Minimal Runtime Container
# ==========================================

FROM alpine:3.24 AS runner

# hadolint ignore=DL3018
RUN apk add --no-cache ca-certificates libc6-compat bash netcat-openbsd

WORKDIR /etc/temporal

ARG GIT_HOST=github.com
ARG ORG_NAME=temporalio
ARG PROJECT_NAME=temporal
ARG RUNTIME_SOURCE_PATH=/go/src/${GIT_HOST}/${ORG_NAME}/${PROJECT_NAME}

COPY --from=builder ${RUNTIME_SOURCE_PATH}/temporal-server /usr/local/bin/temporal-server
COPY --from=builder ${RUNTIME_SOURCE_PATH}/temporal-sql-tool /usr/local/bin/temporal-sql-tool
COPY --from=builder ${RUNTIME_SOURCE_PATH}/schema/postgresql /etc/temporal/schema/postgresql

COPY packages/deploy/containers/temporal/src/config.yaml ./config/config.yaml

# hadolint ignore=DL3021
COPY --chmod=0755 packages/deploy/containers/temporal/src/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN addgroup -S -g 1002 temporal \
    && adduser -S -u 1002 -G temporal temporal \
    && chown -R temporal:temporal /etc/temporal

USER 1002

EXPOSE 7233 7234 6933

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
