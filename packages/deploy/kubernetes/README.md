# `@ai-crew-suite/deploy-kubernetes`

⚓ High-availability production Kubernetes deployment schemas and release-orchestration templates for the AI Crew Suite platform.

## Overview

This workspace package contains the structural **Helm Charts** and deployment manifests required to release the AI Crew Suite platform onto production cloud infrastructure clusters. It encapsulates cluster runtime topologies, ingress routing maps, horizontal auto-scaling rules, and zero-downtime health verification frameworks, transforming raw container builds into resilient, scalable application environments.

## Core Responsibilities

- **Multi-Tier Orchestration**: Segregates server orchestration layers into specialized sub-charts matching our hybrid execution model (Legacy vs Modern testing endpoints and Temporal workers).
- **Self-Healing Topologies**: Declares deep liveness and readiness probe metrics to ensure automated rollouts safely discard stalling containers without introducing service interruptions.
- **Secret Perimeter Security**: Avoids unencrypted variable definitions, instead exposing declarative hook arrays that consume credential keys dynamically via secure cloud environment injection points.

## Difference Between `backstage` and `platform` Helm Charts

These two Helm configurations separate user-facing interfaces from heavy backend execution tasks:

| Attribute             | Backstage Chart (`.../helm/backstage/templates/deployment.yaml`) | Platform Chart (`.../helm/platform/templates/deployment.yaml`) |
| --------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| **Primary Process**   | **Node.js Web & API Gateway Server**                         | **Temporal Agentic Workflow Worker Nodes**                   |
| **Primary Role**      | Runs the Backstage container image to compile dashboards and route user REST API interactions. | Runs **core automation logic** (the custom background python/node worker threads). |
| **Network Presence**  | **Public/External Facing**. Requires an Ingress network rule and Load Balancer port routing to expose the UI. | **Internal/Private Only**. Has no ports exposed to the web. It communicates entirely via outbound worker polls to Temporal. |
| **Network Variables** | Requires `APP_BASE_URL` to route cross-origin browser queries correctly. | Does **not** use `APP_BASE_URL`. It ignores web addresses because it handles asynchronous processing. |
| **Scaling Profiles**  | Scaled horizontally based on browser query loads and request traffic volume. | Scaled horizontally based on background queue depth and heavy orchestration tasks. |

## Architectural Dependency Tree

This deployment engine functions as our primary packaging layer for production cloud environments:

- **Upstream Drivers**: Built on standard Cloud Native Computing Foundation (CNCF) Kubernetes specifications and Helm v3 validation frameworks.
- **Downstream Consumers**: Consumed directly by automated GitOps delivery pipelines (such as ArgoCD or Flux) to enforce cloud state boundaries.
- **Boundary Rule**: This workspace governs architecture definitions exclusively. Never bake explicit regional configurations or raw server access keys directly into these blueprint templates.

## Local Development Workflow

### Validating Helm Parameters

To verify that modifications to your chart values, variables, and loop structures conform strictly to Kubernetes API schemas, run from the monorepo root:

```bash
yarn helm:lint
```

### Rendering Manifest Dry-Runs

To execute a local dry-run compile pass and inspect exactly how your Helm expressions expand into raw Kubernetes YAML manifests, run:

```bash
yarn helm:template
```

## Consumer Integration Checklist

To adapt or extend resource properties across our active application tiers, update the matching parameter blocks within the configuration matrix:

### Inject Runtime Resource Overrides

Update your cloud resource boundaries to protect your compute space from memory leaks or thread exhaustion spikes:

```yaml
# packages/deploy-kubernetes/helm/values-prod.yaml
backstage:
  resources:
    limits:
      cpu: "1000m"
      memory: 2Gi
    requests:
      cpu: "500m"
      memory: 1Gi
```

### Deployment Configuration Matrix

Verify that your deployment parameters align with these mandatory architectural boundaries:

- **`helm/backstage/`**: Application server portal chart managing replica boundaries, ingress setups, and automated health checks.
- **`helm/platform/`**: Core workflow execution engine chart dedicated to scaling high-throughput Temporal agent workers.
- **`helm/values.yaml`**: Standard baseline development defaults optimized for offline execution paths.
- **`helm/values-prod.yaml`**: Deep production configuration overrides enforcing high-availability replicas and cloud secret bindings.

## Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.
Licensed under the **Apache License, Version 2.0**.
