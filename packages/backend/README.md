# `@ai-crew-suite/backend-modern`

🚀 Modern dependency-injection backend integration test bench and validation engine for the AI Crew Suite platform.

## Overview

This workspace package provides an isolated execution profile for the new Backstage backend system. It serves as our primary verification layer for modern plugin architectures, leveraging declarative module assembly and type-safe dependency injection (DI). It ensures all platform features, workflow agents, and custom modules align perfectly with modern Backstage system constraints before hitting public cloud staging.

## Core Responsibilities

- **Declarative System Assembly**: Leverages `createBackend` to orchestrate runtime initialization automatically through modular extension frameworks.
- **Modern Dependency Injection**: Utilizes type-safe container registration via extension points, removing traditional imperative wiring code.
- **Compliance Sandboxing**: Houses custom governance policies—such as our blanket authorization bypass rules—to isolate and protect automated testing streams.

## Architectural Dependency Tree

This test bench represents the forward-facing runtime environment standard for our monorepo setups:

- **Upstream Engine**: Fabricated on top of modern `@backstage/backend-defaults` paradigms and native Node ES Modules (`NodeNext`).
- **Downstream Consumers**: Invoked directly by automated Playwright E2E suites to validate new system integrations and frontend component interactions.
- **Boundary Rule**: Always write code using explicit modular boundaries. Custom rules must be registered via `createBackendModule`. Never mix legacy imperative setup files into this workspace folder.

## Local Development Workflow

### Installation & Workspace Compilation

Transpile the modern server structure and compile production definitions directly from the monorepo root:

```bash
yarn install --refresh
yarn start:modern --build
```

### Running the Modern Test Bench Server

To boot up the new system server profile locally and evaluate file mutations on the fly, run:

```bash
yarn start:modern
```

## Consumer Integration Checklist

To introduce or test a modular plugin architecture within this test bench, inject the module directly into the backend initialization thread:

### Inject an Extension Module

Register your custom provider or tool module using native import strings:

```typescript
// packages/backend-modern/src/index.ts
import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend();

// Core features...
backend.add(import('@backstage/plugin-catalog-backend/alpha'));

// 🎯 Custom Extension Injection
backend.add(import('@ai-crew-suite/drivers'));

backend.start();
```

### Modern Server Configuration Matrix

Verify that your workspace configurations match these mandatory execution boundaries:

- **`src/index.ts`**: The main entry point. Initializes the core assembly container and mounts dependencies through fluent `.add()` tracks.
- **`src/plugins/permission.ts`**: The custom security module override. Activates our safe authorization bypass to unlock local headless execution sweeps.
- **`tsconfig.json`**: Explicitly locks in `experimentalDecorators` and `emitDecoratorMetadata` to sustain Backstage type-based DI engines.

## Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.
Licensed under the **Apache License, Version 2.0**.
