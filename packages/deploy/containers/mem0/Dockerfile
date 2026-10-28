# ==========================================
# STAGE 1: Dependency Assembly
# ==========================================

FROM python:3.11.10-slim-bookworm AS builder

ARG GIT_HOST=github.com
ARG ORG_NAME=mem0ai
ARG PROJECT_NAME=mem0
ARG ENGINE_VERSION=v2.2.1

WORKDIR /build

# hadolint ignore=DL3008
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    gcc \
    g++ \
    musl-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Clone using dynamic string tokens to prevent URL filter parsing errors
RUN git clone --depth 1 --branch ${ENGINE_VERSION} https://${GIT_HOST}/${ORG_NAME}/${PROJECT_NAME}.git .

COPY packages/deploy/containers/mem0/src/server-config.patch /tmp/server-config.patch
COPY packages/deploy/containers/mem0/src/workbench_config.py /build/server/workbench_config.py
RUN git apply --check /tmp/server-config.patch && git apply /tmp/server-config.patch

# Inject and process your decoupled python dependencies
COPY packages/deploy/containers/mem0/requirements.txt ./requirements.txt

# Install packages into the build environment so spaCy commands work instantly,
# then download the required model assets.
# hadolint ignore=DL3013
RUN pip install --no-cache-dir -r server/requirements.txt -r requirements.txt \
    && python -m spacy download en_core_web_sm

# ==========================================
# STAGE 2: Slim Production Runtime
# ==========================================

FROM python:3.11.10-slim-bookworm AS runner

WORKDIR /app

# hadolint ignore=DL3008
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Copy the entire python environment mapping out of the builder stage
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

COPY --from=builder /build /app

# hadolint ignore=DL3021
COPY --chmod=0755 packages/deploy/containers/mem0/src/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN groupadd -g 1001 mem0group \
    && useradd -u 1001 --gid mem0group --create-home --shell /bin/bash mem0user \
    && chown -R mem0user:mem0group /app

USER 1001

EXPOSE 8000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
