# Mock Annotations for AI Crew Suite Dev Server Catalog Entities

High-fidelity static data fixtures

## Overview

This workspace package serves as the centralized provider of programmatic metadata, schemas, and runtime fixtures for the AI Crew Suite software catalog. Rather than maintaining brittle, high-maintenance duplicates of YAML configurations, this package allows engineers to use strongly typed TypeScript factory functions to safely enrich existing Backstage catalog entities with complex mock annotations, payload strings, and simulated environment states.

## Core Responsibilities

- **Ecosystem Simulation**: Provisions high-fidelity mock annotations and structural parameters to mirror real production environments during local exploration and testing.
- **Documentation Isolation**: Hosts pre-compiled HTML documentation, telemetry specs, and dynamic schema attachments decoupled from core application logic.
- **Hermetic Test Grounding**: Serves as the single source of truth for test fixtures, establishing deterministic runtime responses for sandbox components and UI validations.

## Architectural Dependency Tree

```bash
@ai-crew-suite/catalog-fixtures (This Package)
├── @backstage/catalog-model (Core Entity types and interfaces)
└── [Consuming Applications]
└── packages/backstage/backend (Ingests registry via Custom Module Processors)
```

## Local Development Workflow

To bootstrap the workspace dependencies, initialize the package by executing the following command from your repository root:

```bash
yarn install
```

### Executing Static Data Lint Sweeps

To check that your structure conforms to syntax rules and does not introduce duplicate object properties or structural regressions, execute:

```bash
yarn turbo run lint --filter=@ai-crew-suite/catalog-fixtures
```

### Automated Code Style Fixing

To automatically fix formatting errors, trailing spaces, or indentation variations inside your mock assets instantly, run:

```bash
yarn turbo run format --filter=@ai-crew-suite/catalog-fixtures
```

### Validating Fixture Integrity

To verify that all factory functions accurately produce valid entity fragments and that JSON payloads stringify without errors, run the test suites:

```bash
yarn turbo run test:unit --filter=@ai-crew-suite/catalog-fixtures
```

## Consumer Data Checklist

To extend the fixture registry or safely integrate these annotations into a new Backstage backend deployment, verify the following steps:

- **Explicit Registry Binding**: The entity target name must match the key mapped inside the central `catalogFixtureRegistry` dictionary.
- **Valid JSON Serialization**: Nested objects passed into factory templates must cleanly parse back out via standard browser/Node `JSON.parse` commands.
- **Workspace Dependency Linking**: Ensure your consuming backend contains `"@ai-crew-suite/catalog-fixtures": "workspace:*"` inside its local `package.json` dependencies block.

### Data Maintenance Operations

When updating mock attributes (such as rotated telemetry tokens, changed ownership mappings, or new API routes), update the specific file inside `src/fixtures/` directly. Running the centralized build pipeline will automatically propagate those updates to all localized dev instances upon the next catalog refresh cycle.

## Static Data Component Matrix

| Fixture Module | Intended Entity Target | Output Format | Common Use Cases |
| :--- | :--- | :--- | :--- |
| `paymentService.ts` | `payment-service` | Stringified JSON Payload | Simulating operational metadata, billing schemas, and platform alerts. |
| *Future Fixtures* | *Any `Component` / `API`* | *Flat or Nested Object* | *Mocking PagerDuty schedules, SonarQube metrics, or custom UI widgets.* |

## Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.  
Licensed under the **Apache License, Version 2.0**.
