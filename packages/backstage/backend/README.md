# Backstage Backend Server for Dev and CI

This workspace package provides a zero-config, isolated setup for a modern Backstage backend system. It serves as the primary development and verification layer for independent plugin architectures, leveraging declarative module assembly and type-safe dependency injection (DI).

## 🛠️ Overview & Architecture

Unlike traditional production backends that statically compile internal plugin arrays, this tool acts as a **dynamic orchestrator**. It is distributed as a package to let individual plugin repositories boot a pre-configured Backstage server instantly without maintaining framework boilerplate.

### Why the `skeleton/` Directory Exists in this Package

The Backstage CLI (`@backstage/cli package start`) requires structural config files (`backstage.json`, `tsconfig.json`) to determine the compilation target matrix, locate package roles, and manage hot-reloading file watchers.

To keep individual plugin workspaces clean, this orchestrator package ships a **centralized `skeleton/` directory** containing an isolated configuration baseline (`app-config.dev.yaml`), TypeScript path inheritance rules, and version trackers. When a developer runs the startup command, our launcher leverages these files to trick the Backstage CLI into treating the calling plugin as part of its native compilation graph—restoring **full Hot Module Replacement (HMR)** and source-mapping.

### Why the `dev/` Directory is Necessary in Calling Plugins

The Backstage CLI enforces strict execution patterns based on package roles. For packages labeled with `"role": "backend-plugin"`, the framework mandates that local testing loops occur inside a isolated `dev/` directory rather than polluting the distribution-ready `src/` directory.

To hook a plugin into our server, calling sites add a simple `dev/index.ts` file. This script initializes a Backstage instance, links into this workbench code layer, and uses a clean **static relative import** to register the plugin's local code context into the dependency injection matrix.

## 🏗️ Core Responsibilities

- **Declarative System Assembly**: Leverages `createBackend` alongside our `launcher.js` to orchestrate runtime initialization automatically through modular extension frameworks.
- **Modern Dependency Injection**: Utilizes type-safe container registration via extension points, removing traditional imperative wiring code.
- **Zero-Config Developer Experience**: Spawns an internal compilation layer that watches local source directories, automatically handling transpilation on the fly.
- **Compliance Sandboxing**: Houses custom governance policies—such as our blanket authorization bypass rules—to enable automated testing streams.

## 📈 Local Engine Maintenance (This Package)

These commands are for linting, typechecking, and testing the backend workbench backend dev server package itself within this repo.

### Running Lint

To lint the backstage dev server package:

```bash
yarn turbo run lint --filter=@ai-crew-suite/workbench-backend
```

### Running Typecheck

To typecheck the backstage dev server package:

```bash
yarn turbo run typecheck --filter=@ai-crew-suite/workbench-backend
```

### Running Unit Tests

To run unit tests:

```bash
yarn turbo run test:unit --filter=@ai-crew-suite/workbench-backend
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
// plugins/your-plugin-backend/dev/index.ts
import { createBackend } from '@backstage/backend-defaults';
import helloWorldPlugin from '../src/index';

async function main() {
  const backend = createBackend();

  // Statically inject your local plugin features into the test bench thread
  backend.add(helloWorldPlugin);

  // Start the isolated backend server safely
  await backend.start();
}

main().catch(err => {
  console.error('❌ Standalone testpad container failed:', err);
  process.exit(1);
});
```

### 3. Export Your Plugin Layout Natively

Ensure your plugin's main code path (`src/index.ts`) exposes your initialized backend feature as a **default export**, matching official Backstage architectural specifications:

```typescript
// plugins/your-plugin-backend/src/index.ts
import {
    createBackendPlugin,
    coreServices,
} from '@backstage/backend-plugin-api';
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

### 4. Add Catalog Fixtures (Optional)

This backend dev server is configured to automatically load an example service catalog to test or develop against. That behavior can be disabled ([see below](#catalog-optional-fixtures-processor)), and catalog entries and annotations can be added or modified from your plugin. To add a catalog entity:

```yaml
# plugins/your-plugin-backend/dev/catalog-info.yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: payment-service
  description: Manages credit card transactions
  annotations:
    'example.com/local': |
      {
        "generatedAt": "2026-10-15T05:00:00Z",
        "fixtureStatus": "active",
        "notes": "Inline team annotation defined locally inside testpad context."
      }
spec:
  type: service
  lifecycle: production
  owner: billing-team
```

You can also add a `kind: Location` file to organize multiple catalog entity files:
```yaml
apiVersion: backstage.io/v1alpha1
kind: Location
metadata:
  name: organizational-services
  description: Main index of all active team repositories
spec:
  type: url
  targets:
    - ./mocks/**/catalog-info.yaml
```

### 5. Add Client Backend Plugins or Modules (Optional)

Clients can cleanly pass a single reference or array of references to any additional plugins, modules, or custom service overwrites to the backend dev server:

```typescript
import { catalogPlugin } from '@backstage/plugin-catalog-backend';
import { catalogModuleTemplateKind } from './my-custom-module';

await startDevBackend({
  features: [
    catalogPlugin,               // Standard Backend Plugin
    catalogModuleTemplateKind,   // Extension Module
  ]
});
```

### 6. Running the Dev Server

To fire up the server inside the plugin directory and activate hot-reloading, execute:

```bash
LOG_LEVEL=debug yarn turbo run start --filter=@your-org/your-plugin-backend
```

To override the default dev configuration with a custom local profile, add a local configuration file in your plugin:

```yaml
# plugins/your-plugin-backend/dev/app-config.dev.yaml
app:
  # This overrides "AI Crew Suite Platform" from
  # backend server programmatic configuration
  title: "Your Backend Plugin"

# Custom Configuration for your backend plugin
myCustomPlugin:
  featureX: true
```

### 7. Verify Dev Server is Running Correctly

```bash
curl -i -H "Authorization: Bearer dev-secret-token-placeholder" http://localhost:7007/api/hello-world/health
```

## ⚙️ Custom Modules Included in Backend Dev Server

The pre-configured workbench backend dev server includes the following bundled plugins.

### Catalog Optional Fixtures Processor

The workbench dev server defines two files to load catalog entities from in client plugins, `dev/catalog-info.yaml` for a single file of catalog entities and `dev/location.yaml` if organizing catalog entities across multiple files. If either of these files are missing, Backstage would normally generate warnings during startup since they're specified in server configuration. This plugin quiets those warnings for these two specific files.

To disable this behavior, add the following to the plugin's `dev/app-config.dev.yaml` file:

```yaml
aiCrewSuite:
  modules:
    optionalLocalFixtures:
      enabled: false
```

### Catalog Schema Extensions

Backstage provides the following `Kinds` of catalog entities by default: `Component`, `Api`, `Resource`, `System`, `Domain`, `User`, and `Group`. This plugin adds the kinds `DataProduct`, `Model`, `Product`, `Vulnerability`, and `ArchitectureDecision` to validate custom enterprise taxonomies against mandatory internal schemas, and to enforce explicit data policies, severity matrices, and operational ownership bounds before data commits to the catalog database.

To disable the predefined custom kinds for catalog entities, add the following to your plugin's `dev/app-config.dev.yaml` file:

```yaml
aiCrewSuite:
  modules:
    customKinds:
      enabled: false
```

### Dynamic Annotation Processor

The Workbench includes the `@ai-crew-suite/fixtures-annotations` package which provides a comprehensive set of annotations for catalog entities defined in the `@ai-crew-suite/fixtures-catalog` package, for development and testing. This package is consumed by the dynamic annotation entity injector, and loaded during startup of the backend dev server.

To disable loading annotations to catalog entities during localized testing sessions, add the following to the plugin's `dev/app-config.dev.yaml` file:

```yaml
aiCrewSuite:
  modules:
    fixtureAnnotations:
      enabled: false
```

### Dynamic Catalog Entity Injection

The Workbench includes the `@ai-crew-suite/fixtures-catalog` package which provides a comprehensive software catalog of entities for development and testing. This package is consumed by the dynamic catalog entity injector, and loaded during startup of the backend dev server.

To disable loading the mock catalog during localized testing sessions, add the following to the plugin's `dev/app-config.dev.yaml` file:

```yaml
aiCrewSuite:
  modules:
    dynamicEntities:
      enabled: false
```

### Dynamic Scaffolder Template Injection

The Workbench includes the `@ai-crew-suite/fixtures-scaffolder` package which provides programmatic Scaffolder Template fixtures for development and testing. These templates are emitted by the same dynamic fixture provider as the catalog entities above, but are governed by a separate configuration toggle so each fixture group can be enabled or disabled independently.

To disable loading the scaffolder templates during localized testing sessions, add the following to the plugin's `dev/app-config.dev.yaml` file:

```yaml
aiCrewSuite:
  modules:
    scaffolderTemplates:
      enabled: false
```

### Test Permission Policy

The Workbench backend dev server includes a very open default permission policy. It issues unconditional blanket approvals (`AuthorizeResult.ALLOW`) for all incoming permission requests. Its primary purpose is to act as an unrestrictive pass-through layer that eliminates permission bottlenecks during local workspace sandboxing, prototyping, and testing.

Clients can replace the default policy with their own custom permission policy like this:

```typescript
import { startDevBackend } from '@ai-crew-suite/workbench-backend';
import {
    PermissionPolicy,
    PolicyQuery,
    PolicyQueryUser,
} from '@backstage/plugin-permission-node';
import {
    AuthorizeResult,
    PolicyDecision,
} from '@backstage/plugin-permission-common';

/**
 * Implement a local security matrix
 */
class EnterpriseRBACPolicy implements PermissionPolicy {
  async handle(
    request: PolicyQuery,
    user?: PolicyQueryUser
   ): Promise<PolicyDecision> {
    // Lock down critical catalog deletion workflows locally
    if (request.permission.name === 'catalog.entity.delete') {
      return { result: AuthorizeResult.DENY };
    }

    // Fall back to allowing other workspace prototyping behaviors
    return { result: AuthorizeResult.ALLOW };
  }
}

/**
 * Launch the environment with your policy attached
 */
await startDevBackend({ customPolicy: new EnterpriseRBACPolicy() });
```

### WireMock Bootstrapper

Provisions an automated `wiremockBootstrapperModule` API extension that crawls your monorepo workspaces on startup, auto-discovering localized plugin mock configurations and seamlessly syncing JSON endpoint stubs into active WireMock proxy containers to create zero-config offline developer environments.

To disable loading the automatic background scanning and ingestion of WireMock mock stubs, add the following to the plugin's `dev/app-config.dev.yaml` file:

```yaml
aiCrewSuite:
  modules:
    wiremockBootstrapper:
      enabled: false
```

### Wiremock Interceptor

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
