# OpenTelemetry Collector Gateway Image

A hardened, zero-trust container specification providing a standalone **OpenTelemetry (OTel) Collector** gateway configured with custom gRPC data routing maps for the AI Crew Suite platform.

## 📦 Operational Role

This container acts as the telemetry ingress and propagation authority across isolated environment boundaries.

* **Local Machine Development**: Provisions background telemetry nodes to receive cross-boundary distributed execution logs over host gRPC port 4317, routing spans seamlessly without third-party internet dependencies.
* **CI/CD Automation & Playwright E2E**: Launches within the secure VPC testing parameter during integration browser sweeps to swallow, process, and propagate real-time trace events from ephemeral Backstage web pods and Temporal agent loops.

## 🛠 Workspace Tasks

Execute these pipeline tasks via Turborepo from the monorepo root:

### Image Compilation

```bash
yarn turbo run build --filter=@ai-crew-suite/otel-container
```

### Static Analysis & Best Practices Linting

```bash
yarn turbo run lint --filter=@ai-crew-suite/otel-container
```

### Declarative Structure Verification

```bash
yarn turbo run image:test:structure --filter=@ai-crew-suite/otel-container
```

### Vulnerability Security Scanning

```bash
yarn turbo run image:test:security --filter=@ai-crew-suite/otel-container
```

### Integration Smoke Testing

```bash
yarn turbo run image:test:unit --filter=@ai-crew-suite/otel-container
```

### Artifact Distribution

```bash
yarn turbo run publish --filter=@ai-crew-suite/otel-container
```

## ⚖ Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.  
Licensed under the **Apache License, Version 2.0**.
