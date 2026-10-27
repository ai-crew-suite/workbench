# Grafana Tempo Tracing Backend Image

A high-performance, distributed tracing store container specification utilizing **Grafana Tempo** to capture, isolate, and display unified execution span timelines for the AI Crew Suite platform.

## 📦 Operational Role

This container acts as the downstream tracing storage authority, aggregating and indexing asynchronous execution paths traversing microservice system boundaries.

* **Local Machine Development**: Provisions background trace logging nodes on the workstation network to monitor microservice call loops, database transactions, and internal event cascades completely offline.
* **CI/CD Automation & Playwright E2E**: Launches inside isolated testing namespaces during integration testing sweeps to track request propagation delays and surface structural processing bottlenecks across Temporal worker nodes and web endpoints.

## 🛠 Workspace Tasks

Execute these pipeline tasks via Turborepo from the monorepo root:

### Image Compilation

```bash
yarn turbo run build --filter=@ai-crew-suite/tempo-container
```

### Static Analysis & Best Practices Linting

```bash
yarn turbo run lint --filter=@ai-crew-suite/tempo-container
```

### Declarative Structure Verification

```bash
yarn turbo run image:test:structure --filter=@ai-crew-suite/tempo-container
```

### Vulnerability Security Scanning

```bash
yarn turbo run image:test:security --filter=@ai-crew-suite/tempo-container
```

### Integration Smoke Testing

```bash
yarn turbo run image:test:unit --filter=@ai-crew-suite/tempo-container
```

### Artifact Distribution

```bash
yarn turbo run publish --filter=@ai-crew-suite/tempo-container
```

## ⚖ Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.  
Licensed under the **Apache License, Version 2.0**.
