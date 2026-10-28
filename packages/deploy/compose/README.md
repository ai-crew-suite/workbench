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
- For a host Ollama server, `OLLAMA_BASE_URL` defaults to
  `http://host.docker.internal:11434`; Compose maps that name to the host
  gateway. On Linux, Ollama must listen on an address reachable from the Docker
  bridge: a listener bound only to `127.0.0.1` cannot be reached this way.
  Configure Ollama's `OLLAMA_HOST` and restart Ollama as needed. Binding to
  `0.0.0.0` can expose the unauthenticated API to other networks, so restrict
  access with a firewall or an appropriately scoped bind address.
- Set `MEM0_EMBEDDING_DIMENSIONS` to the actual output size of the Ollama
  embedding model (4096 for `qwen3-embedding:8b`). For dimensions above 2000,
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

### Validating Configuration Schemas and Variables

To evaluate whether your compose files are syntactically valid and confirm that required environment variables are mapped correctly, run:

```bash
yarn turbo run lint --filter=@ai-crew-suite/compose
```

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
