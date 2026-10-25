# AI Crew Suite Dockerfiles

This workspace package manages the Docker infrastructure blueprints used to spin up deterministic, zero-trust container environments for **automated Playwright E2E tracks**, local engineering, and CI pipelines.

## Core Infrastructure Stack

When spun up via our orchestration pipeline, this package provisions a complete standalone environment:

* **Backend Harness**: A pre-compiled Backstage Node runtime shell ready to dynamically accept and run external plugin logic.
* **Frontend Harness**: An Nginx container optimized to serve compiled plugin static assets with zero performance overhead.
* **Temporal Cluster Engine**: A custom, decoupled **temporal-server** compiled from source from Go targets, with integrated **temporal-sql-tool** migrations to handle task orchestration over gRPC without relying on deprecated auto-setup abstractions.
* **Mem0 Memory Node**: A standalone, self-hosted **Mem0 FastAPI REST API service** compiled from source that provides unified HTTP endpoints for agent long-term memory management and semantic graph orchestration.
* **Data Layer Isolation**: A pre-configured **pgvector/pgvector:17** engine that serves double duty: hosting standard relational schemas for Temporal tables, while simultaneously instantiating vector extensions and Hierarchical Navigable Small World (HNSW) index trees to support Mem0 episodic memory loops.
* **Traffic Simulation**: A standalone **WireMock** network boundary interceptor used to isolate third-party platform API vectors (like PagerDuty or Datadog) completely offline.

## Architectural Workflow (CI vs. Local)

* **Local Machine Development**: Developers run dev servers natively on their host machines. Code compiles on-the-fly; Docker is used solely to provision background databases and infrastructure nodes (`pgvector`, `temporal`, `mem0`) if needed.
* **CI E2E Automation Layer**:
  1. This package compiles and publishes generic `workbench-backend-base`, `workbench-frontend-base`, `workbench-temporal-base`, and `workbench-mem0-base` runner images.
  2. Consuming plugin repos pull these base images, inject their specific feature payloads, and boot the cluster instantly via Docker Compose.

## Development Scripts

Run these tasks from the **monorepo root** utilizing Turborepo's pipeline caching framework:

### Linting Dockerfiles

To lint all system Dockerfiles against strict image layer best practices using Hadolint, run:

```bash
yarn turbo run lint --filter=@ai-crew-suite/dockerfiles
```

### Compiling Base Images

To compile the baseline frontend compiler, backend execution harness, and standalone infrastructure engines locally, run:

```bash
yarn turbo run build --filter=@ai-crew-suite/dockerfiles
```

Alternatively, you can target specific sub-components using individual script aliases:

```bash
# Build only the Temporal Cluster image
yarn workspace @ai-crew-suite/dockerfiles build:temporal

# Build only the Mem0 Memory service image
yarn workspace @ai-crew-suite/dockerfiles build:mem0
```

## External Service and Kubernetes Mock Ingestion & Tooling

Mock injection, WireMock mapping synchronization, and traffic payload verifications are fully managed through our custom **`workspace-cli`** tool.

## Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.
Licensed under the **Apache License, Version 2.0**.
