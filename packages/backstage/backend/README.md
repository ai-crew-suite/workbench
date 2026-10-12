# Backstage Backend Server for Dev and CI

🚀 **Modern Dependency-Injection Backend integration test bench and validation engine for the AI Crew Suite platform.**

This workspace package provides a zero-config, isolated execution profile for the modern Backstage backend system. It serves as our primary verification layer for independent plugin architectures, leveraging declarative module assembly and type-safe dependency injection (DI). It ensures all platform features, workflow agents, and custom modules align perfectly with modern Backstage system constraints before hitting public cloud staging.

## 🛠️ Overview & Architecture

Unlike traditional production backends that statically compile internal plugin arrays, this tool acts as a **dynamic orchestrator**. It is distributed via our registry to let individual plugin repositories boot a pre-configured Backstage server instantly without maintaining framework boilerplate.

### Why the `skeleton/` Directory Exists

The Backstage CLI (`@backstage/cli package start`) requires structural config files (`backstage.json`, `tsconfig.json`) to determine the compilation target matrix, locate package roles, and manage hot-reloading file watchers.

To keep individual plugin workspaces clean, this orchestrator package ships a **centralized `skeleton/` directory** containing an isolated configuration baseline (`app-config.dev.yaml`), TypeScript path inheritance rules, and version trackers. When a developer runs the startup command, our launcher leverages these files to trick the Backstage CLI into treating the calling plugin as part of its native compilation graph—restoring **full Hot Module Replacement (HMR)** and source-mapping.

### Why the `dev/` Directory Exists in Calling Plugins

The Backstage CLI enforces strict execution patterns based on package roles. For packages labeled with `"role": "backend-plugin"`, the framework mandates that local testing loops occur inside a isolated **`dev/` directory** rather than polluting the distribution-ready `src/` directory.

To hook a plugin into our server, calling sites add a simple `dev/index.ts` file. This script initializes a Backstage instance, links into our pre-compiled workbench code layer, and uses a clean **static relative import** to register the plugin's local code context into the dependency injection matrix.

## 🏗️ Core Responsibilities

- **Declarative System Assembly**: Leverages `createBackend` alongside our `launcher.js` to orchestrate runtime initialization automatically through modular extension frameworks.
- **Modern Dependency Injection**: Utilizes type-safe container registration via extension points, removing traditional imperative wiring code.
- **Zero-Config Developer Experience**: Spawns an internal compilation layer that watches local source directories, automatically handling transpilation on the fly.
- **Compliance Sandboxing**: Houses custom governance policies—such as our blanket authorization bypass rules—to isolate and protect automated testing streams.

## 📈 Local Engine Maintenance (This Package)

These commands are for maintaining, testing, and building the orchestrator utility package itself within our core platform repository.

### Monorepo Build Execution

To heal TypeScript project references, align graph configurations, and build the shared backend tool, execute:

```bash
yarn turbo run build --filter=@ai-crew-suite/workbench-backend
```

### Running Unit Tests & Test Coverage

To execute the complete Vitest suite (which mocks the filesystem paths and fetch traversal loops using strict, decoupled mock boundaries), run:

```bash
yarn turbo run test:unit --filter=@ai-crew-suite/workbench-backend
yarn turbo run test:unit:coverage --filter=@ai-crew-suite/workbench-backend
```

## 🔌 Consumer Integration Guide (How Plugins Use This)

Follow this checklist to enable standalone, zero-config local boot loops inside an isolated backend plugin workspace.

### 1. Configure the Plugin's `package.json`

Add the orchestrator package to your `devDependencies` and configure the `start` script to target our custom binary wrapper:

```json
{
  "name": "@ai-crew-suite/plugin-custom-feature-backend",
  "version": "1.0.0",
  "backstage": {
    "role": "backend-plugin"
  },
  "scripts": {
    "start": "backstage-dev-server"
  },
  "devDependencies": {
    "@ai-crew-suite/workbench-backend": "workspace:*"
  }
}
```

### 2. Establish the Standard `dev/` Entry Point

Create a new file at `dev/index.ts` to hook your local plugin code directly into Backstage's core registry:

```typescript
// dev/index.ts
import { createBackend } from '@backstage/backend-defaults';
import helloWorldPlugin from '../src/index';

async function main() {
  const backend = createBackend();

  // 🎯 Statically inject your local plugin features into the test bench thread
  backend.add(helloWorldPlugin);

  // 🚀 Start the isolated backend server safely
  await backend.start();
}

main().catch(err => {
  console.error('Standalone testpad container collapsed:', err);
  process.exit(1);
});
```

### 3. Export Your Plugin Layout Natively

Ensure your plugin's main code path (`src/index.ts`) exposes your initialized backend feature as a **default export**, matching official Backstage architectural specifications:

```typescript
// src/index.ts
import { createBackendPlugin, coreServices } from '@backstage/backend-plugin-api';
import express from 'express';

export default createBackendPlugin({
  pluginId: 'hello-world',
  register(env) {
    env.registerInit({
      deps: { httpRouter: coreServices.httpRouter },
      async init({ httpRouter }) {
        const router = express.Router();
        router.get('/health', (_req, res) => res.json({ status: 'ok' }));
        httpRouter.use(router);
      },
    });
  },
});
```

### 4. Running the Dev Server

To fire up the server inside the plugin directory and activate hot-reloading, execute:

```bash
yarn turbo run start --filter=@ai-crew-suite/testpad-backend
```

To override the default dev configuration with a custom local profile, pass the configuration flag directly through the execution args:

```bash
yarn start --config ./custom-local-config.yaml
```

## 🛡️ Architectural Configuration Invariants

Our bundled `skeleton/app-config.dev.yaml` contains dedicated rules to support air-gapped CI and local developer workstations:

- **Database Isolation**: Automatically swaps heavy PostgreSQL infrastructure out for an internal, thread-safe memory mapping pool using `better-sqlite3`.
- **Global Traffic Interception**: Transparently patches global fetch loops; any outbound plugin calls to third-party dependencies are intercepted and automatically redirected to an isolated WireMock proxy mesh (`http://localhost:8080`).
- **Strict VPC Sandboxing**: Implements an absolute dark-site reading block list to guarantee zero public cloud calling leaks.

## 📄 Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.
Licensed under the **Apache License, Version 2.0**.
