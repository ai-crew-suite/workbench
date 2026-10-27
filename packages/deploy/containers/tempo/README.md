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
* **OpenTelemetry Collector Gateway**: A standalone **otel-collector** daemon container featuring a baked-in, zero-host-dependency data routing configuration map to ingest, process, and propagate cross-boundary trace telemetry over gRPC port 4317.
* **Prometheus Metrics Engine**: A custom metrics time-series store running **Prometheus v3** configured with an automated 5-second polling schedule tracking native Temporal worker loops, Mem0 REST nodes, and Redis metrics sidecars completely out-of-the-box.
* **Tempo Tracing Backend**: A highly performant distributed tracing store utilizing **Grafana Tempo** to capture, store, and display unified execution span timelines for downstream microservice calls.
* **Grafana Control Panel**: A pre-provisioned visualization hub running **Grafana v13** that automatically loads internal database paths and dashboards (including dedicated layouts for tracking Temporal task queue starvation and Redis memory limits) with zero manual click configuration.

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
yarn turbo run lint --filter=@ai-crew-suite/containers
```

Lint a single targeted Container:

```bash
# Lint only the Temporal Cluster image
yarn turbo run image:lint --filter=@ai-crew-suite/containers -- temporal
```

### Run All Tests

To run all image tests against all system Dockerfiles, run:

```bash
yarn turbo run test --filter=@ai-crew-suite/containers
```

### Dockerfile Security Scanning

To run the Trivy security scan against all system Dockerfiles, run:

```bash
yarn turbo run image:test:security --filter=@ai-crew-suite/containers
```

Scan a single targeted Container:

```bash
# Scan only the Temporal Cluster image
yarn turbo run image:test:security --filter=@ai-crew-suite/containers -- temporal
```

### Dockerfile Structure Tests

To run Google Container Structure tests against all system Dockerfiles, run:

```bash
yarn turbo run image:test:structure --filter=@ai-crew-suite/containers
```

Structure test a single targeted Container:

```bash
# Structure test only the Temporal Cluster image
yarn turbo run image:test:structure --filter=@ai-crew-suite/containers -- temporal
```

### Dockerfile Smoke Tests

To run the Vitest integration tests for built images against all system Dockerfiles, run:

```bash
yarn turbo run image:test:unit --filter=@ai-crew-suite/containers
```

Vitest integration test a single targeted Container:

```bash
# Vitest integration test only the Temporal Cluster image
yarn turbo run image:test:unit --filter=@ai-crew-suite/containers -- temporal
```

### Compiling Base Images

To compile the baseline images locally, run:

```bash
yarn turbo run build --filter=@ai-crew-suite/containers
```

Build a single targeted Container:

```bash
# Build only the Temporal Cluster image
yarn turbo run image:build --filter=@ai-crew-suite/containers -- temporal
```

## External Service and Kubernetes Mock Ingestion & Tooling

Mock injection, WireMock mapping synchronization, and traffic payload verifications are fully managed through our custom **`workspace-cli`** tool.

## Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.
Licensed under the **Apache License, Version 2.0**.
