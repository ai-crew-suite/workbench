# Workbench Docker Compose File

Centralized multi-container orchestration blueprints, Docker Compose environment layouts, and local cluster networking profiles for spinning up isolated workbench components and Wiremock virtualization services.

## 🏗️ Core Responsibilities

- **Multi-Container Orchestration**: Manages the boot, restart, and link lifecycles of the application's local components.
- **Service Virtualization Gateway**: Provisions automated Wiremock containers to intercept third-party cloud metrics and alerts natively.
- **Zero-Config Teardown**: Provides clean environment sweeps to scrub stale anonymous volumes and orphaned container instances between execution loops.

## 📈 Local Engine Maintenance

These commands are for maintaining and verifying the internal configuration stability of your compose definitions.

### Service startup notes

- PostgreSQL's messages about database files being owned by `postgres` and fixing
  permissions during initialization are informational when followed by `ok`.
  The named volume is mounted at the PostgreSQL 18 data root and is retained.
- Temporal initializes its main schema in `POSTGRES_DB` and its visibility
  schema in a separate database, `temporal_visibility` by default. Override the
  latter with `TEMPORAL_VISIBILITY_DB`; the PostgreSQL user must have permission
  to create it. Existing databases and volumes are not deleted.
- Mem0 supports `openai` and `ollama` as startup LLM and embedding providers.
  OpenAI needs `MEM0_PROVIDER_API_KEY`; Ollama does not. Set
  `MEM0_LLM_PROVIDER`, `MEM0_EMBEDDER_PROVIDER`, their model variables, and
  optionally `MEM0_LLM_TEMPERATURE` and `MEM0_LLM_MAX_TOKENS`. Startup
  environment settings take precedence over saved API configuration on restart.
- Compose starts the Ollama image and waits for it to be healthy before
  starting Mem0. `OLLAMA_BASE_URL` defaults to `http://ollama:11434`, using
  Compose service discovery; Ollama's port is not published to the host.
  The service uses `local/ollama-container:${IMAGE_TAG:-latest}` by default,
  matching the local image build. Set `OLLAMA_IMAGE_REPOSITORY` to use a
  published repository instead. Models baked into the image are available
  without a volume; models pulled into a running container are lost when it
  is recreated.
- To use a host Ollama server instead, override `OLLAMA_BASE_URL` with a
  reachable address such as `http://host.docker.internal:11434`. The name is
  mapped to the host gateway, but a host listener bound only to `127.0.0.1`
  cannot be reached this way. Exposing Ollama beyond loopback can make its
  unauthenticated API accessible to other networks. The Compose Ollama service
  is still started and required to be healthy even with a custom URL or OpenAI.
- Set `MEM0_EMBEDDING_DIMENSIONS` to the actual output size of the Ollama
  embedding model (1024 for `bge-m3`, or 4096 for `qwen3-embedding:8b`).
  For dimensions above 2000,
  pgvector uses exact search rather than an HNSW vector index. Use a distinct
  `POSTGRES_COLLECTION_NAME` when changing embedding models or dimensions;
  existing collections are not migrated or deleted.
- Mem0 needs `MEM0_JWT_SECRET` for authentication. Alternatively, set
  `MEM0_AUTH_DISABLED=true` **only for local development**. Set
  `MEM0_TELEMETRY=false` to opt out of anonymous telemetry. Its application
  tables are migrated into `POSTGRES_DB` on startup.

Changes to the Mem0 and Temporal Dockerfiles or entrypoints require rebuilding
and publishing their images before restarting the stack. Compose-only changes
take effect when the affected service is recreated.

The startup-script regression tests use mocked service binaries and do not
start containers. They require Python 3, Bash, `jq`, and `envsubst`:

```bash
python3 -m unittest discover -s packages/deploy/compose/__tests__ -p 'test_service_entrypoints.py'
python3 -m unittest discover -s packages/deploy/containers/mem0/__tests__ -p 'test_workbench_config.py'
```

The Compose configuration regression tests require Docker Compose, but do not
start containers:

```bash
python3 -m unittest discover -s packages/deploy/compose/__tests__ -p 'test_compose_config.py'
```

### Validating Configuration Schemas and Variables

To evaluate whether your compose files are syntactically valid and confirm that required environment variables are mapped correctly, run:

```bash
yarn turbo run lint --filter=@ai-crew-suite/compose
```

### Publishing the Compose artifact

Install the ORAS CLI (version 1.2 or newer) and authenticate with the registry
as needed. The publisher pushes the original Compose YAML as a Compose OCI
artifact, without interpolating or including the local `.env` file. Review
the YAML itself for hard-coded secrets before publishing. The default local
registry uses HTTP; other registries use HTTPS unless `--plain-http` is passed.

```bash
yarn turbo run publish --filter=@ai-crew-suite/compose
```

For a non-loopback HTTP registry, run the CLI with `--plain-http` explicitly.
Signing remains optional and uses Cosign when configured.

### Starting the Local Container Stack

To spin up all backend, frontend, and mocking containers in a detached background state, execute:

```bash
yarn workspace @ai-crew-suite/compose up
```

### Tearing Down the Cluster

To gracefully stop active service grids, purge ephemeral data volumes, and eliminate unmanaged background layers, run:

```bash
yarn workspace @ai-crew-suite/compose down
```

## 📄 Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.
Licensed under the **Apache License, Version 2.0**.
