```
@ai-crew-suite/containers
```

🐳 Local container runtime, database schemas, and mock proxy infrastructure control planes for the AI Crew Suite platform.

## Overview

This workspace package encapsulates the local orchestration networks used to create deterministic, zero-trust environments for local development and automated Playwright E2E tracks. By binding a pre-configured **PostgreSQL with `pgvector`** engine, an in-memory **Redis cache layer**, and a **WireMock traffic interceptor** into a single system, it allows developers to test complex agent workflows offline with zero external network dependencies.

## Core Responsibilities

- **Data Layer Isolation**: Provisions isolated schemas for separate Backstage sub-systems and agent memory tables on initialization to eliminate locking deadlocks.
- **Vector Engine Preparation**: Automatically instantiates the native `pgvector` extensions and sets up Hierarchical Navigable Small World (HNSW) index trees to support long-term episodic memory loops (Mem0).
- **Traffic Simulation**: Mounts read-only WireMock structural maps to intercept third-party platform call paths (such as PagerDuty and Datadog), forcing secure, mock responses at the network boundary.

## Architectural Dependency Tree

This container matrix drives the localized physical data networks for all platform repositories:

- **Upstream Drivers**: Built on official Docker Hub base containers (`pgvector/pgvector:17` and `wiremock/wiremock:3.9.1-alpine`).
- **Downstream Consumers**: Invoked by every active repository layer (`agents`, `platform`, `drivers`) to establish localized testing targets on developers' machines.
- **Boundary Rule**: This workspace manages operational environment assets exclusively. Never commit production cloud passwords or application source code directly to this sub-directory layer.

## Local Development Workflow

### Launching the Infrastructure Stack

To pull down the container assets, run database schema initializers, and bring the local service network up, run from the monorepo root:

```bash
yarn infra:up
```

### Tracking System Container Logs

To stream live diagnostic output and background database operations directly onto your workstation terminal, execute:

```bash
yarn infra:logs
```

### Tearing Down the Local Sandbox

To safely stop the execution runtimes and suspend the network bridges without purging your persistent data volumes, trigger:

```bash
yarn infra:down
```

## Consumer Integration Checklist

To extend the mock proxy perimeter or add high-fidelity API payloads to your testing scopes, register your files within the mock control mapping layout:

### Inject an Inline Mapping Matcher

Create a new JSON descriptor inside the mappings folder to intercept an outbound call matching a target route:

```json
// packages/containers/mock-control-plane/mappings/custom-tool.json
{
  "request": {
    "method": "GET",
    "url": "/api/v1/custom-tool/status"
  },
  "response": {
    "status": 200,
    "body": "{\"status\": \"healthy\", \"synchronized\": true}",
    "headers": { "Content-Type": "application/json" }
  }
}
```

### Local Operational Footprint Matrix

Ensure your localized structural folders contain these required infrastructure assets:

- **`docker-compose.yml`**: The central container orchestration manifest mapping host networks, persistence loops, and service health checks.
- **`database-init/pgvector-setup.sql`**: Automatic database initialization scripts handling isolated DB provisions and vector distance indices.
- **`mock-control-plane/mappings/`**: Declarative WireMock proxy match rules forcing predictable traffic simulation paths.
- **`mock-control-plane/__files/`**: External static asset storage area housing complex multi-line json exemplar datasets.

## Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.
Licensed under the **Apache License, Version 2.0**.
