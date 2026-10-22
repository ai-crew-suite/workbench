# Mock Scaffolder Templates for AI Crew Suite Dev Server

Hermetic and offline-safe programmatic Software Templates used to validate the task execution engine and simulate workspace orchestration pipelines on the AI Crew Suite dev backend.

## Overview

This workspace package provides high-fidelity, programmatic Scaffolder Template fixtures designed to populate the Backstage Software Templates ecosystem during local developer sandbox runs. By providing pre-configured templates that run natively without hitting production remote Git endpoints or external cloud platform providers, this library gives platform engineers an instant way to debug task pipeline lifecycles, validate schema steps, and verify downstream execution workflows locally.

## Core Responsibilities

- **Ecosystem Simulation**: Provisions interactive multi-step wizard blueprints to mimic real-world container bootstrapping and developer workflows.
- **Workflow Automation Validation**: Exercises the core Scaffolder step-runner engine locally by supplying complex parameter parameters, validation blocks, and structural markdown responses.
- **Hermetic Test Grounding**: Eliminates network dependencies during automated pipeline sweeps by relying completely on offline-safe built-in actions (`debug:log`).

## Architectural Dependency Tree

These programmatic template configurations interface with your dev environment orchestration layer. When loaded into the backend catalog, their execution structure flows as follows:

```text
[ User Interface ] ──(Submits Parameters)──> [ Scaffolder Engine /api/scaffolder/v2 ]
                                                      │
                                                      ├──> [ Step 1: Input Validation ]
                                                      ├──> [ Step 2: Context Token Seeding ]
                                                      │
                                           [ Formatted Markdown Output ]
```

## Local Development Workflow

To pull down monorepo configurations and sync dependencies, execute the following from your project root:

```bash
yarn install
```

### Executing Static Data Lint Sweeps

To verify that your template configuration objects match our strict workspace TypeScript guidelines, run:

```bash
yarn turbo run lint --filter=@ai-crew-suite/fixtures-scaffolder
```

### Automated Code Style Fixing

To automatically fix formatting errors, trailing spaces, or indentation variations inside your mock assets instantly, run:

```bash
yarn turbo run format --filter=@ai-crew-suite/fixtures-scaffolder
```

### Running the Test Suite

To execute isolated package unit tests and verify parameter parsing states, run:

```bash
yarn turbo run test:unit --filter=@ai-crew-suite/fixtures-scaffolder
```

## Consumer Data Checklist

When designing a new programmatic software template to seed into this repository, make sure it satisfies the following checklist criteria:

- [ ] **Strict Output Compliance**: Ensure `spec.output.text` is an array of Markdown text blob objects (`{ if?, title?, icon?, content }`) matching the runtime v1beta3 JSON Schema. A plain string value is rejected by the catalog's `ScaffolderEntitiesProcessor`, which silently hides the template from the frontend catalog.
- [ ] **Network Isolation**: Restrict standard action definitions to offline-safe steps (e.g., `debug:log`) unless your development environment includes pre-configured, live proxy endpoints.
- [ ] **Ownership Assignment**: Explicitly define a valid `spec.owner` that bridges back to one of the teams established inside the `@ai-crew-suite/fixtures-catalog` topology map.

### Data Maintenance Operations

The primary data blueprints are stored within `src/fixtures/workbenchTemplates.ts`. To change user inputs, augment parameters, or implement new simulation tasks, update the programmatic arrays returned by `getWorkbenchScaffolderTemplates()`.

## Static Data Component Matrix

| Template ID | Target UI Title | Spec Type | Key Simulated Steps | Owner |
| :--- | :--- | :--- | :--- | :--- |
| `offline-hello-world` | Offline Hello World Scaffold | `service` | Parameter logging / Hermetic validation | `platform-team` |
| `ai-agent-provisioner`| AI Agent Runtime Provisioner | `agent` | Parameter checks / Synthetic credentials allocation | `tools-crew-team` |

## Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.
Licensed under the **Apache License, Version 2.0**.
