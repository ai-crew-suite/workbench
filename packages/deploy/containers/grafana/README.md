# Grafana Visualizations Hub Image

A pre-configured, production-hardened container specification providing an embedded **Grafana v13** operational metrics dashboard hub for the AI Crew Suite platform.

## 📦 Operational Role

This container provides a centralized control panel populated with pre-baked visualization dashboards mapping core system boundaries out-of-the-box.

* **Local Machine Development**: Provisions background telemetry panels on the workstation cluster network to track internal thread pool metrics and database query cycles completely offline.
* **CI/CD Automation & Playwright E2E**: Spins up inside isolated Kubernetes staging namespaces to evaluate resource starvation, Temporal queue backpressure bottlenecks, and telemetry tracking profiles automatically during automated workflows.

## 🛠 Workspace Tasks

Execute these pipeline tasks via Turborepo from the monorepo root:

### Image Compilation

```bash
yarn turbo run build --filter=@ai-crew-suite/grafana-container
```

### Static Analysis & Best Practices Linting

```bash
yarn turbo run lint --filter=@ai-crew-suite/grafana-container
```

### Declarative Structure Verification

```bash
yarn turbo run image:test:structure --filter=@ai-crew-suite/grafana-container
```

### Vulnerability Security Scanning

```bash
yarn turbo run image:test:security --filter=@ai-crew-suite/grafana-container
```

### Integration Smoke Testing

```bash
yarn turbo run image:test:unit --filter=@ai-crew-suite/grafana-container
```

### Artifact Distribution

```bash
yarn turbo run publish --filter=@ai-crew-suite/grafana-container
```

## ⚖ Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.  
Licensed under the **Apache License, Version 2.0**.
