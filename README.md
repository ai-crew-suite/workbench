# AI Crew Suite — Workbench (`workbench`)

![AI Crew Suite Workbench splash image](./ai-crew-suite-social-share-workbench.jpg)

Centralized Infrastructure-as-Code (IaC), deployment charts, deterministic local development runtimes, and regulatory-compliant mock ecosystems for the AI Crew Suite platform.

> [!WARNING]
> This repo is pre-beta and under going heavy development as of October, 2026. We are refactoring from LangGraph to a fluent API for workflows in agentic plugins based on Temporal + Mem0 Vercel AI SDK.

## 📋 Overview

This repository serves as the single source of truth for the provisioning, deployment, and high-fidelity simulation of the AI Crew Suite architecture across all development and production environments. It isolates our cloud topology definitions, orchestration layers, and testing sandboxes from individual application codebases, enabling robust GitOps delivery models and frictionless local execution.

## 📂 Repository Topology

The repository is structured as a unified Yarn Workspace monorepo, enforcing strict domain isolation and operational consistency:

```text
ai-crew-suite/infra/
├── .yarnrc.yml                          # Optimized local Yarn 4 version catalog governance
├── turbo.json                           # Centralized Turborepo pipeline caching rules
├── packages/
│   ├── app-config/                      # Central configuration templates & development overrides
│   ├── backend-legacy/                  # Express-based integration test bench (CommonJS)
│   ├── backend-modern/                  # Modern dependency-injection test bench (ES Modules)
│   ├── containers/                      # Local Docker Compose network (Postgres + pgvector, Redis, WireMock)
│   ├── deploy-kubernetes/               # High-availability production Helm charts (Backstage + Workers)
│   ├── deploy-terraform/                # Managed AWS Cloud Topologies (VPC, ECR, RDS, ElastiCache)
│   ├── mock-fixtures/                       # Static Backstage catalog entities & pre-compiled TechDocs assets
│   └── mock-service/                    # In-memory browser network traffic interceptor (MSW)
```

## 🚀 Local Development Quickstart

### 1. Initialize the Monorepo Workspace

Ensure you have [Yarn 4+](https://yarnpkg.com) installed. Link the workspace packages and download required development tools:

```bash
yarn install
```

### 2. Stand Up the Local Container Network

Spin up the offline data layer, configure the `pgvector` schemas, and launch the third-party proxy interceptors:

```bash
yarn infra:up
```

*This command starts PostgreSQL on host port `5433` (to prevent conflicts with native workstation databases), maps your long-term agent memory tables (Mem0), and starts WireMock on port `8080`.*

### 3. Run the Backend Test Benches

Verify code compilation, type safety, and configuration routing across both system variants simultaneously:

```bash
yarn compile           # Compiles all TypeScript packages via Turborepo
yarn start:modern      # Launches the Modern DI Backstage testing instance
yarn start:legacy      # Launches the Traditional Express Backstage testing instance
```

### 4. Adding Packages

This repo sets `enableImmutableCache` to `true` in `.yarnrc.yml` for compliance with FINRA, SOC-2, and HIPAA enterprise environments. This enforces cryptographic reproducibility and supply-chain immutability in the repo. It also blocks adding or upgrading package versions locally. Renovatebot handles this automatically by executing Yarn in a mode equivalent to `--mode=update-lockfile`. To add a package locally:

```bash
YARN_ENABLE_IMMUTABLE_CACHE=false yarn install
```

## 📡 Consuming the Dev / Test Server in Other Repos

## 🛡️ Verification & Compliance Standards

Every package workspace inside this repository implements standardized verification tasks to pass quality gates before code promotion steps:

```bash
yarn lint         # Evaluates codebase formatting via Prettier and lint rules via eslint.config.ts
yarn tf:validate  # Verifies HashiCorp infrastructure layouts are syntactically valid
yarn helm:lint    # Audits Kubernetes Helm charts against production schema configurations
yarn image:build  # Compiles a hardened, multi-stage production Docker image securely
```

## Coordination with GitHub Self-Hosted CI Runners

To execute high-fidelity Playwright end-to-end (E2E) automation suites securely, this repository avoids using public GitHub-hosted compute clusters. Instead, our deployment charts and Infrastructure-as-Code modules are orchestrated dynamically inside an **Ephemerally Orchestrated Infrastructure Loop** powered by internal self-hosted runners.

```text
[GitHub Actions Runner]
       │
       ▼ (Runs `terraform apply` & `helm install`)
┌────────────────────────────────────────────────────────┐
│             AWS VPC Secure Target Perimeter            │
│                                                        │
│  ┌───────────────────────┐    ┌─────────────────────┐  │
│  │  EKS Kubernetes Pods  │───>│ AWS RDS PostgreSQL  │  │
│  │  (Your Test Server)   │    │ (Vector Seeds)      │  │
│  └───────────────────────┘    └─────────────────────┘  │
│              ▲                                         │
└──────────────┼─────────────────────────────────────────┘
               │ (Executes headless tests safely inside the VPC)
[Self-Hosted EKS Runner Pod]
```

### 🔐 Mandatory CI Pipeline Environment Matrix

To prevent compilation crashes and ensure absolute cryptographic supply-chain security inside the isolated AWS network perimeter, the automated **GitHub Actions Preview Pipeline** expects the following explicit secret tokens and variable injections:

#### 1. Security & Authentication Secrets (`secrets.*`)

- `AWS_ACCOUNT_ID`: The unique 12-digit AWS registry owner identifier used to cleanly target your private Elastic Container Registry (ECR) endpoints.
- `AWS_ACCESS_KEY_ID`: The operational access credential token allowing the public GitHub-hosted runner (`ubuntu-latest`) to validate its identity during initial infrastructure steps.
- `AWS_SECRET_ACCESS_KEY`: The cryptographically masked access key used to authorize secure resource provisioning sweeps.
- `AWS_PROD_DB_HOST`: The secure endpoint address of your AWS RDS PostgreSQL cluster, mapped straight to the cluster's internal storage layer.
- `AWS_PROD_DB_PASSWORD`: The high-security password injected straight into the `TF_VAR_database_secure_password` block to seed your relational PostgreSQL nodes non-interactively.

#### 2. Dynamic Runtime Environment Variables (`env.*`)

- `APP_BASE_URL`: Generated on the fly matching the format `https://preview-pr-${{ github.event.number }}.ai-crew-suite.dev`. This is passed straight into the multi-stage Backstage Node container process via Helm parameters to securely bind cross-origin (CORS) rules and API gateway routes.
- `AWS_DEFAULT_REGION`: Explicitly locked to `us-east-1` to govern standard geographical location targeting across all cluster load balancers.
- `DB_PORT`: Automatically shifts from the local developer conflict-bypass port (`5433`) back to the standard database port (`5432`) inside the cloud testing namespace.
- `MOCK_PROXY_URL`: Formatted dynamically as `http://wiremock-service.platform-preview-pr-${{ github.event.number }}.svc.cluster.local:8080`. This maps the internal Kubernetes DNS name of the WireMock pod to intercept Datadog and PagerDuty calls at the namespace boundary.
- `MOCK_FIXTURES_PATH`: Injected as `./mock-fixtures` to account for the flattened file directory tree inside the final production container (`WORKDIR /app`).

### Ephemeral Staging Lifecycle Mechanics

1. **The Trigger**: Opening or updating a Pull Request checks your internal changesets and automatically cancels any outdated, in-flight builds via explicit workflow concurrency parameters.
2. **The Compilation Step**: The pipeline triggers a direct filesystem read of your modular packages, executing a quiet `yarn install --immutable` check. It builds a hardened multi-stage release image (`ai-crew-suite/backstage:latest`) and pushes it to ECR, tagged with the matching PR tracking number (`pr-42`).
3. **The Isolated Rollout**: Helm provisions a brand-new, isolated Kubernetes namespace (`platform-preview-pr-42`). It splits deployment pods elegantly into public-facing **Backstage Web Nodes** on port `7007` and private, high-throughput **Temporal Agent Workers**.
4. **The Verification Sweep**: Headless Playwright integration browsers launch straight from the self-hosted runner pod inside the secure VPC boundary—running tests against the preview endpoint with massive network speed and total database isolation.

### The Operational Lifecycle Track

1. **The Handshake Trigger**: A pull request is opened. The GitHub Actions orchestrator assigns the job to a **self-hosted runner daemon running directly inside your AWS EKS cluster** (using tools like *Actions Runner Controller (ARC)*) or an auto-scaled EC2 compute instance.
2. **Infrastructure Provisioning**: Because the runner resides *inside* your AWS network boundary, it securely invokes your **Terraform and Helm blueprints** to provision a brand-new, isolated namespace or container environment specifically for that specific Pull Request.
3. **Test Execution**: Playwright launches headlessly on the self-hosted runner. It runs its browser sweeps directly against the newly spawned Kubernetes test pod inside the safe VPC zone—guaranteeing rapid network throughput and data isolation.
4. **Tear Down**: Once the test suite concludes (pass or fail), the runner triggers a cleanup track (`helm uninstall` / `terraform destroy`) to wipe the environment, maintaining **SOC 2 cost and resource hygiene**.

### How Automated AWS Preview URL Flow Works

1. When your GitHub Actions runner executes `helm install`, it passes a dynamic identifier (like the PR number: `pr-42`) into the Helm values.
2. Your Ingress manifest detects this and creates an AWS Application Load Balancer with a dynamic rule.
3. **ExternalDNS** intercepts this rule, hooks into AWS Route 53, and automatically registers a transient record: `https://preview-pr-42.ai-crew-suite.dev`.

## Playwright Tests

When Playwright boots up to test your user-facing Agent interfaces, the base driver fixtures are already completely populated in WireMock by the backend module.

If your Playwright script needs to force a specific behavior (like simulating a flaky Datadog agent stream during an execution cycle), it simply pulls the *exact same class definition* to alter the environment rules dynamically:

```typescript
// apps/agents-e2e/tests/agent-triaging.spec.ts
import { test, expect } from '@playwright/test';
import { WireMockClient } from '@internal/wiremock-utils'; // Same code resource!

test.describe('Agentic Error Resolution Interface Checks', () => {
  const wm = new WireMockClient();

  test.afterEach(async () => {
    // Clear out any messy test-specific modifications. 
    // Note: Re-triggering backend initialization or hitting a reload hook will restore the original baselines.
    await wm.clearDynamicMocks();
  });

  test('should gracefully surface a UI notification banner if the driver API drops connectivity', async ({ page }) => {
    // 1. Override the baseline driver responses with a test-specific 500 error stub
    await wm.registerStub({
      request: { method: 'GET', url: '/api/v1/pagerduty/history' },
      response: { status: 500 }
    });

    // 2. Drive the UI with Playwright
    await page.goto('/agents/incident-dashboard');
    const alertBanner = page.locator('[data-testid="error-alert"]');
    
    await expect(alertBanner).toBeVisible();
    await expect(alertBanner).toContainText('PagerDuty link degraded');
  });
});
```

## Vitest inside Storybook (Component & User-Flow Testing)

Storybook uses Vitest to power its **Interaction Tests** (playing the role that Testing Library used to play). When testing your agent UI components inside Storybook:

- **The Problem:** Your agent UI components make API calls to the Backstage backend, which in turn calls the drivers, which call WireMock. Alternatively, your components might hit a proxy that goes straight to WireMock.
- **The Solution:** Inside a Storybook `.stories.tsx` file, you can use the `play` function (Storybook's built-in interaction testing phase powered by Vitest) to programmatically prep WireMock right before the component renders.

```typescript
// packages/app/src/components/AgentDashboard.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { AgentDashboard } from './AgentDashboard';
import { WireMockClient } from '@internal/wiremock-utils';
import { userEvent, within, expect } from '@storybook/test'; // Storybook's Vitest-backed testing utilities

const wm = new WireMockClient('http://localhost:8080'); // Point directly to the WireMock port

const meta: Meta<typeof AgentDashboard> = {
  component: AgentDashboard,
  title: 'Agents/Dashboard',
};
export default meta;

type Story = StoryObj<typeof AgentDashboard>;

export const OvercapacityAlertState: Story = {
  // The 'play' function is executed by Vitest during Storybook test runs
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 1. Programmatically set up the exact network state this UI component needs
    await wm.registerStub({
      request: { method: 'GET', url: '/api/v1/metrics/vector-capacity' },
      response: {
        status: 200,
        jsonBody: { utilization: 98.4, status: 'CRITICAL' }
      }
    });

    // 2. Assert that the UI reacted correctly to the WireMock state we just injected
    const alert = await canvas.findByTestId('capacity-alert-banner');
    await expect(alert).toBeInTarget();
    await expect(alert).toHaveTextContent('Vector Engine Approaching Limit');
  },
};
```

## ⚖️ Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.
Licensed under the **Apache License, Version 2.0**.
