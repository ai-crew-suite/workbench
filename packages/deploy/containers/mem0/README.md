# Mem0 Memory Node Image

A standalone, self-hosted container specification providing a pre-compiled **Mem0 FastAPI REST API service** for long-term agent memory management and semantic graph orchestration.

## 📦 Operational Role

This container isolates and manages the cognitive persistence layers required by agentic worker loops within the AI Crew Suite platform.

* **Local Machine Development**: Provisions background memory nodes on the workstation network, exposing high-throughput HTTP endpoints to simulate agent long-term memory workflows completely offline.
* **CI/CD Automation & Playwright E2E**: Integrates dynamically with the isolated data layer namespace during testing sweeps to validate episodic memory retrievals and multi-agent knowledge graph graphs under realistic conditions.

## 🛠 Workspace Tasks

Execute these pipeline tasks via Turborepo from the monorepo root:

### Image Compilation

```bash
yarn turbo run build --filter=@ai-crew-suite/mem0-container
```

### Static Analysis & Best Practices Linting

```bash
yarn turbo run lint --filter=@ai-crew-suite/mem0-container
```

### Declarative Structure Verification

```bash
yarn turbo run image:test:structure --filter=@ai-crew-suite/mem0-container
```

### Vulnerability Security Scanning

```bash
yarn turbo run image:test:security --filter=@ai-crew-suite/mem0-container
```

### Integration Smoke Testing

```bash
yarn turbo run image:test:unit --filter=@ai-crew-suite/mem0-container
```

### Artifact Distribution

```bash
yarn turbo run publish --filter=@ai-crew-suite/mem0-container
```

## ⚖ Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.  
Licensed under the **Apache License, Version 2.0**.
