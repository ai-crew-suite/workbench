# Wiremock External Platform API Fixtures for AI Crew Suite Dev Server

This workspace package provides a centralized, type-safe array provider of mock API calls and response states for external integrations like PagerDuty and Datadog. It hooks directly into our global Wiremock interceptor layers during backend development runs, removing external network dependencies and ensuring integration pipelines stay fully isolated and deterministic.

## 🏗️ Core Responsibilities

- **Third-Party Simulation**: Emulates vendor gateway boundaries for infrastructure metrics, key checks, and telemetry alerts.
- **Unified Schema Enforcement**: Types incoming payloads against strict `WiremockMapping` specs to flag contract breaking changes before execution runs.
- **Zero-Network Grounding**: Enables local features—such as PagerDuty alerting toggles—to act realistically without mutating active external dashboards.

## 📈 Local Engine Maintenance (This Package)

Use these commands to evaluate, build, or test this data-mapping wrapper module inside our platform framework repository.

### Running Lint Sweeps

To evaluate the static TypeScript configurations against our workspace lint guidelines, execute:

```bash
yarn turbo run lint --filter=@ai-crew-suite/fixtures-external
```

### Automated Code Style Fixing

To automatically fix formatting errors, trailing spaces, or indentation variations inside your mock assets instantly, run:

```bash
yarn turbo run format --filter=@ai-crew-suite/fixtures-external
```

### Static Typechecking

To verify that your vendor parameters align with the mapping schemas, execute:

```bash
yarn turbo run typecheck --filter=@ai-crew-suite/fixtures-external
```

### Running the Test Suite

To run isolated package validation checks and ensure entities conform to core schemas, execute:

```bash
yarn turbo run test:unit --filter=@ai-crew-suite/fixtures-external
```

## 📄 Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.
Licensed under the **Apache License, Version 2.0**.
