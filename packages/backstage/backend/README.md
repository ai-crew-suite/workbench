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

These commands are for maintaining, testing, and linting the orchestrator utility package itself within our core platform repository.

### Running Lint

To trigger the Crew CLI provided ESLint configuration, execute:

```bash
yarn turbo run lint --filter=@ai-crew-suite/workbench-backend
```

### Running Unit Test Suites

To trigger a `tsc` typecheck run, execute:

```bash
yarn turbo run typecheck --filter=@ai-crew-suite/workbench-backend
```

### Debugging

These may be helpful in debugging the backend server, using the default api server port:

```bash
curl -v "http://localhost:7007/api/user-settings/buckets"
curl -v "http://localhost:7007/api/catalog/health"
curl -v "http://localhost:7007/api/catalog/entities"
curl -s "http://localhost:7007/api/catalog/locations"
curl -v "http://localhost:7007/api/scaffolder/v2/templates"
curl -v "http://localhost:7007/api/search/query?term=&types%5B0%5D=software-catalog&pageLimit=1"

LOG_LEVEL=debug yarn turbo run start --filter=@ai-crew-suite/testpad-backend > boot.log 2>&1
cat boot.log | grep -i "DynamicFixtureEntityProvider\|catalog"
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
LOG_LEVEL=debug yarn turbo run start --filter=@ai-crew-suite/testpad-backend
```

To override the default dev configuration with a custom local profile, pass the configuration flag directly through the execution args:

```bash
yarn start --config ./custom-local-config.yaml
```

### 5. Verify Dev Server is Running Correctly

```bash
curl -i -H "Authorization: Bearer dev-secret-token-placeholder" http://localhost:7007/api/hello-world/health
```

## 🛡️ Architectural Configuration Invariants

Our bundled `skeleton/app-config.dev.yaml` contains dedicated rules to support air-gapped CI and local developer workstations:

- **Database Isolation**: Automatically swaps heavy PostgreSQL infrastructure out for an internal, thread-safe memory mapping pool using `better-sqlite3`.
- **Global Traffic Interception**: Transparently patches global fetch loops; any outbound plugin calls to third-party dependencies are intercepted and automatically redirected to an isolated WireMock proxy mesh (`http://localhost:8080`).
- **Strict VPC Sandboxing**: Implements an absolute dark-site reading block list to guarantee zero public cloud calling leaks.

## ⚙️ Extension Modules Included in Backend Dev Server

### Optional Local Fixtures Parsing (`modules/catalog-optional-fixtures-processor`)

Mounts an automated `catalogOptionalLocalFixturesModule` backend processor that intercepts the custom `crew-suite-optional-fixtures` location type, providing zero-noise parsing of developers' untracked local sandbox YAML entities while cleanly bypassing boot-time exceptions if the files are physically absent.

To disable loading predefined catalog entities during localized testing sessions, add the following to tye plugin's `dev/app-config.dev.yaml` file:

```yaml
aiCrewSuite:
  modules:
    optionalLocalFixtures:
      enabled: false
```

### Custom Kinds Contract Validation (`modules/catalog-schema-extensions`)

Plugs a strict `CustomKindsModule` parser into the ingestion framework that validates custom enterprise taxonomies (`DataProduct`, `Model`, `Product`, `Vulnerability`, and `ArchitectureDecision`) against mandatory internal schemas, enforcing explicit data policies, severity matrices, and operational ownership bounds before data commits to the catalog database.

To disable predefined custom Kinds for catalog entities during localized testing sessions, add the following to tye plugin's `dev/app-config.dev.yaml` file:

```yaml
aiCrewSuite:
  modules:
    customKinds:
      enabled: false
```

### Declarative Annotation Injection (`modules/dynamic-annotation-processor`)

Hooks an automated `catalogModuleFixtureAnnotations` engine into the global entity ingestion pipeline, dynamically appending developer-defined telemetry tags and integration identifiers to targeted software catalog components during background processing intervals.

To disable loading annotations to catalog entities during localized testing sessions, add the following to tye plugin's `dev/app-config.dev.yaml` file:

```yaml
aiCrewSuite:
  modules:
    fixtureAnnotations:
      enabled: false
```

### Dynamic Catalog Entity Injection ()`modules/dynamic-catalog-entity-processor`)

Integrates a programmatic `catalogModuleDynamicEntities` backend extension that leverages a custom `DynamicFixtureEntityProvider` to dynamically harvest, sign, and patch sandbox environments with a type-safe mock software catalog natively in-memory, bypassing static filesystem mutations.

To disable loading the mock catalog during localized testing sessions, add the following to the plugin's `dev/app-config.dev.yaml` file:

```yaml
aiCrewSuite:
  modules:
    dynamicEntities:
      enabled: false
```

### `modules/test-permission-policy`

### Automated WireMock Fixture Synchronization (`modules/wiremock-bootstrapper`)

Provisions an automated `wiremockBootstrapperModule` API extension that crawls your monorepo workspaces on startup, auto-discovering localized plugin mock configurations and seamlessly syncing JSON endpoint stubs into active WireMock proxy containers to create zero-config offline developer environments.

To disable loading the automatic background scanning and ingestion of WireMock mock stubs, add the following to the plugin's `dev/app-config.dev.yaml` file:

```yaml
aiCrewSuite:
  modules:
    wiremockBootstrapper:
      enabled: false
```

### Global Network Traffic Redirection Interceptor ()`modules/wiremock-interceptor`)

Configures a low-overhead `globalWiremockInterceptorModule` API runtime utility that overrides node's `global.fetch` scope, dynamically rerouting external HTTP/HTTPS API traffic outbound to third-party endpoints directly into local WireMock proxy meshes while safely ignoring database network protocols (PostgreSQL wire and Redis RESP over TCP).

To disable the global fetch network hook loop for raw internet endpoints, add the following to the plugin's `dev/app-config.dev.yaml` file:

```yaml
aiCrewSuite:
  modules:
    globalWiremockInterceptor:
      enabled: false
```

## 📄 Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.
Licensed under the **Apache License, Version 2.0**.
