# `@ai-crew-suite/wiremock-network-interceptor`

```bash
│
└── mock-interceptor/    # 🧪 CODE-LEVEL PROCESS TRAPPING: The MSW browser/node engine
    └── src/drivers.ts   # Configured to import matching datasets straight from ../mock-fixtures/
```

🔌 In-memory code-level network traffic interception engine and Mock Service Worker (MSW) drivers for the AI Crew Suite platform.

## Overview

This workspace package provides an isolated, lightning-fast client-side network simulation layer built on top of **Mock Service Worker (MSW)**. While WireMock manages heavy black-box container networks, this package intercepts outbound HTTP/HTTPS calls directly inside your Node.js or browser engine processes. It provides immediate, zero-latency traffic simulation for unit tests, component integration checks, and headless tracking sweeps.

## Core Responsibilities

- **Traffic Capture Loop**: Intercepts code-level outbound REST/GraphQL API connections at the network layer, preventing calls from bleeding out into the public internet.
- **Ecosystem Contract Mirroring**: Accurately mimics the API signatures, headers, and schemas of your runtime container stack—returning identical data contracts for PagerDuty incidents and Datadog monitors.
- **Security & Token Validation**: Implements mock cryptographic handshake barriers that verify incoming security authorization headers to enforce strict compliance testing.

## Architectural Dependency Tree

This mock framework acts as a fast, in-memory proxy sandbox inside your application test bundles:

- **Upstream Drivers**: Built on top of Mock Service Worker core routing engines (`msw: ^2.4.0`) and compiled using native Node ES Modules (`NodeNext`).
- **Downstream Consumers**: Imported into automated vitest/jest testing bundles, component specs, and localized Playwright browser runner layers.
- **Boundary Rule**: This package is dedicated to code-level traffic interception configurations. Do not link persistent storage adapters, live database connection strings, or unencrypted cloud credentials to these handlers.

## Local Development Workflow

### Workspace Installation & Code Consistency

To integrate this workspace into your monorepo's shared dependency graph and register its TypeScript compiler settings, execute from the repository root:

```bash
yarn install
```

### Compiling the MSW Handlers

To compile the TypeScript interceptor source code into standard JavaScript files ready for test bundle consumption, execute:

```bash
yarn workspace @ai-crew-suite/mock-service run build
```

### Cleaning Up Build Outputs

To safely wipe out compiled distribution folders and clear out old build artifacts from your local directory tree, trigger:

```bash
yarn workspace @ai-crew-suite/mock-service run clean
```

## Consumer Usage Checklist

To use these in-memory mock handlers inside a unit testing suit or an isolated browser environment, import the server controller loop directly into your framework setup file:

### Bootstrapping the MSW Node Interceptor

```typescript
// an example vitest.setup.ts configuration file
import { setupServer } from 'msw/node';
import { driverHandlers } from '@ai-crew-suite/mock-service';

const server = setupServer(...driverHandlers);

// Establish API trapping loops before any test blocks execute
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Mock Engine Component Matrix

Verify that your client-side interceptor workspace maintains these required assets:

- **`src/drivers.ts`**: The main interceptor file housing active mock handler arrays for PagerDuty alert tracking, Datadog metric validations, and Mem0 semantic sync streams.
- **`tsconfig.json`**: Explicitly locks module resolutions to modern `NodeNext` to support clean asynchronous imports across testing scripts.
- **`package.json`**: The workspace project configuration sheet handling compilation steps and holding required open-source testing dependencies.

## Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.
Licensed under the **Apache License, Version 2.0**.
