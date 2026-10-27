# Backstage Backend Dev Server Image

A hardened, zero-trust container specification providing the generic **Backstage Node.js runtime harness shell** for the AI Crew Suite platform.

## 📦 Operational Role

This container is compiled and distributed as a headless execution baseline (`workbench-backend-base`).

* **Local Machine Development**: Engineers execute development instances natively on workstation hosts to allow real-time compilation. This container asset is bypassed during local host runs.
* **CI/CD Automation & Playwright E2E**: This base image is pulled by downstream agentic plugin repositories. The feature payload under test is injected dynamically at the namespace boundary to spin up instant, isolated validation environments.

## 🛠 Workspace Tasks

Execute these pipeline tasks via Turborepo from the monorepo root:

### Image Compilation

```bash
yarn turbo run build --filter=@ai-crew-suite/backend-container
```

### Static Analysis & Best Practices Linting

```bash
yarn turbo run lint --filter=@ai-crew-suite/backend-container
```

### Declarative Structure Verification

```bash
yarn turbo run image:test:structure --filter=@ai-crew-suite/backend-container
```

### Vulnerability Security Scanning

```bash
yarn turbo run image:test:security --filter=@ai-crew-suite/backend-container
```

### Integration Smoke Testing

```bash
yarn turbo run image:test:unit --filter=@ai-crew-suite/backend-container
```

### Artifact Distribution

```bash
yarn turbo run publish --filter=@ai-crew-suite/backend-container
```

## ⚖ Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.  
Licensed under the **Apache License, Version 2.0**.
