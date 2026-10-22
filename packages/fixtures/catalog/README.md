# Mock Catalog Entities for AI Crew Suite Dev Server

Programmatic catalog topology seed entities (Groups, Users, Components, Systems, and Domains) providing baseline infrastructure blueprints for the AI Crew Suite dev workspace server sandbox.

## Overview

This workspace package provides high-fidelity programmatic data fixtures to populate the Backstage Software Catalog during local machine prototyping and sandboxed continuous integration. Instead of making risky, live network connections to external production identity providers or Git repositories, this library supplies a predictable corporate structural map out-of-the-box so backend plugins and frontend interfaces can be verified in a completely hermetic local environment.

## Core Responsibilities

- **Ecosystem Simulation**: Provisions high-fidelity mock organizational models matching realistic workspace team topologies.
- **Documentation Isolation**: Hosts local techdocs and infrastructure layouts to test catalog rendering engines in sandbox environments.
- **Hermetic Test Grounding**: Serves as the stable data baseline ensuring unit, integration, and end-to-end tests run deterministically.

## Architectural Dependency Tree

The programmatic entities are wired together to mimic a complete enterprise architecture. They are structured according to the core Backstage relational topology guidelines:

```text
       [ Domain: fintech ]
                │
        [ System: billing ]
                │
   [ Component: payment-service ] ──(Exposes)──> [ API: payment-api ]
                │
            (Owned By)
                │
      [ Group: platform-team ] ──(Parent)──> [ Group: engineering ]
                │
            (Member)
                │
       [ User: kevin ]
```

## Local Development Workflow

To initialize the monorepo workspace dependencies, run the following from the root directory:

```bash
yarn install
```

### Executing Static Data Lint Sweeps

To evaluate the static TypeScript configurations against our workspace lint guidelines, execute:

```bash
yarn turbo run lint --filter=@ai-crew-suite/fixtures-catalog
```

### Automated Code Style Fixing

To automatically fix formatting errors, trailing spaces, or indentation variations inside your mock assets instantly, run:

```bash
yarn turbo run format --filter=@ai-crew-suite/fixtures-catalog
```

### Running the Test Suite

To run isolated package validation checks and ensure entities conform to core schemas, execute:

```bash
yarn turbo run test:unit --filter=@ai-crew-suite/fixtures-catalog
```

## Consumer Data Checklist

When introducing new mock data schemas to this package, ensure they adhere to the following checklist requirements:

- [ ] **Valid Kinds**: Entity configurations must map to standard Backstage Kinds (`Domain`, `System`, `Component`, `API`, `Resource`, `Group`, `User`).
- [ ] **Strict Owner Matching**: Every new `Component` or `API` must specify a valid `spec.owner` that points back to an existing `Group` or `User` name.
- [ ] **No Hardcoded Secrets**: Production passwords, access tokens, or cloud hashes must never be committed. Use mock keys exclusively.

### Data Maintenance Operations

The primary data entry point is located within `src/fixtures/workbenchService.ts`. To modify existing organizational members, update the respective profile parameters inside the `getWorkbenchTopologyEntities()` instantiation matrix.

## Static Data Component Matrix

| Entity Name | Kind | Type | System Block Context | Primary Owner |
| :--- | :--- | :--- | :--- | :--- |
| `engineering` | Group | `division` | Global Org Container | *N/A (Root Parent)* |
| `platform-team` | Group | `team` | Infra Runtime Squad | `engineering` |
| `payment-service`| Component | `service` | Transaction Core Engine | `platform-team` |
| `kevin` | User | `N/A` | Principal Sandbox Architect| `platform-team` |

## Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.
Licensed under the **Apache License, Version 2.0**.
