# @ai-crew-suite/dockerfiles

This workspace package manages the Docker infrastructure blueprints used to spin up deterministic, zero-trust container environments for **automated Playwright E2E tracks** and CI pipelines.

## Core Infrastructure Stack

When spun up via our orchestration pipeline, this package provisions a complete standalone environment:

* **Backend Harness**: A pre-compiled Backstage Node runtime shell ready to dynamically accept and run external plugin logic.
* **Frontend Harness**: An Nginx container optimized to serve compiled plugin static assets with zero performance overhead.
* **Data Layer Isolation**: A pre-configured **pgvector/pgvector:17** engine that automatically instantiates vector extensions and Hierarchical Navigable Small World (HNSW) index trees to support Mem0 episodic memory loops.
* **Traffic Simulation**: A standalone **WireMock** network boundary interceptor used to isolate third-party platform API vectors (like PagerDuty, Temporal, or Datadog) completely offline.

## Architectural Workflow (CI vs. Local)

* **Local Machine Development**: Developers run dev servers natively on their host machines. Code compiles on-the-fly; Docker is used solely to provision background databases if needed.
* **CI E2E Automation Layer**:

  1. This package compiles and publishes generic `workbench-backend-base` and `workbench-frontend-base` runner images.
  2. Consuming plugin repos pull these base images, inject their specific feature payloads, and boot the cluster instantly via Docker Compose.

## Development Scripts

Run these tasks from the **monorepo root** utilizing Turborepo's pipeline caching framework:

### Linting Dockerfiles

To lint the backend and frontend Dockerfiles against strict image layer best practices using Hadolint, run:

```bash
yarn turbo run lint --filter=@ai-crew-suite/dockerfiles
```

### Compiling Base Images

To build the baseline frontend compiler and backend execution harness layers locally, run:

```bash
yarn turbo run build --filter=@ai-crew-suite/dockerfiles
```

## External Service and Kubernetes Mock Ingestion & Tooling

Mock injection, WireMock mapping synchronization, and traffic payload verifications are fully managed through our custom **`workspace-cli`** tool.

## Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.
Licensed under the **Apache License, Version 2.0**.
