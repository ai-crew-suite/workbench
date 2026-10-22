# @ai-crew-suite/compose

Centralized multi-container orchestration blueprints, Docker Compose environment layouts, and local cluster networking profiles for spinning up isolated workbench components and Wiremock virtualization services.

## 🏗️ Core Responsibilities

- **Multi-Container Orchestration**: Manages the boot, restart, and link lifecycles of the application's local components.
- **Service Virtualization Gateway**: Provisions automated Wiremock containers to intercept third-party cloud metrics and alerts natively.
- **Zero-Config Teardown**: Provides clean environment sweeps to scrub stale anonymous volumes and orphaned container instances between execution loops.

## 📈 Local Engine Maintenance

These commands are for maintaining and verifying the internal configuration stability of your compose definitions.

### Validating Configuration Schemas and Variables

To evaluate whether your compose files are syntactically valid and confirm that required environment variables are mapped correctly, run:

```bash
yarn turbo run lint --filter=@ai-crew-suite/compose
```

### Starting the Local Container Stack

To spin up all backend, frontend, and mocking containers in a detached background state, execute:

```bash
yarn workspace @ai-crew-suite/compose up
```

### Tearing Down the Cluster

To gracefully stop active service grids, purge ephemeral data volumes, and eliminate unmanaged background layers, run:

```bash
yarn workspace @ai-crew-suite/compose down
```

## 📄 Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.
Licensed under the **Apache License, Version 2.0**.
