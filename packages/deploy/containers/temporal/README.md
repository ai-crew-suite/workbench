# Temporal Cluster Engine Image

A custom-configured, decoupled container specification providing a standalone **Temporal server** compiled from source with integrated database migration tools for the AI Crew Suite platform.

## 📦 Operational Role

This container provides the core orchestration engine required to drive complex, multi-step agentic workflows and reliable background task loops securely over high-throughput gRPC channels.

* **Local Machine Development**: Provisions background orchestration engines on the workstation network to manage, execute, and monitor long-running worker loops completely offline without third-party external dependencies.
* **CI/CD Automation & Playwright E2E**: Launches inside isolated Kubernetes namespaces during automated testing suites to validate orchestration flows, state consistency, and multi-agent workflow resiliency under realistic load conditions.

## 🛠 Workspace Tasks

Execute these pipeline tasks via Turborepo from the monorepo root:

### Image Compilation

```bash
yarn turbo run build --filter=@ai-crew-suite/temporal-container
```

### Static Analysis & Best Practices Linting

```bash
yarn turbo run lint --filter=@ai-crew-suite/temporal-container
```

### Declarative Structure Verification

```bash
yarn turbo run image:test:structure --filter=@ai-crew-suite/temporal-container
```

### Vulnerability Security Scanning

```bash
yarn turbo run image:test:security --filter=@ai-crew-suite/temporal-container
```

### Integration Smoke Testing

```bash
yarn turbo run image:test:unit --filter=@ai-crew-suite/temporal-container
```

### Artifact Distribution

```bash
yarn turbo run publish --filter=@ai-crew-suite/temporal-container
```

## ⚖ Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.  
Licensed under the **Apache License, Version 2.0**.
