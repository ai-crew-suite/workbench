# 🧰 AI Crew Suite Workbench CLI

This package is the centralized developer toolbelt and workspace orchestrator for use in AI Crew Suite repos. It consolidates all building, cleaning, linting, typechecking, and testing workflows into a single, high-performance binary utility.

By managing tooling constraints centrally within this package, we can upgrade, patch, or alter repo-wide build steps without touching or changing individual package script blocks across our 60+ workspaces.

## 🚀 Consuming this Toolbelt

Every package in the monorepo utilizes the uniform `workbench` binary interface. To configure a child workspace, simply link the tool and expose its sub-commands within the package's local `package.json`:

```json
{
  "name": "@ai-crew-suite/my-frontend-plugin",
  "scripts": {
    "build": "workbench build",
    "clean": "workbench clean",
    "lint": "workbench lint",
    "test:unit:coverage": "workbench test:unit:coverage",
    "test:unit": "workbench test:unit",
    "typecheck": "workbench typecheck"
  },
  "devDependencies": {
    "@ai-crew-suite/workbench-cli": "workspace:*"
  }
}
```

## 🏛️ Core Features & Architecture

The CLI uses a smart tree-climbing utility (`getWorkspaceContext()`) that reads the executing folder's `package.json` and evaluates Spotify Backstage metadata parameters natively to understand its exact environment constraints.

```json
"backstage": {
  "role": "frontend-plugin"
}
```

### 🧠 Semantic Environment Routing

The tool maps the active workspace's roles into clear semantic runtime boundaries on the fly. This prevents developers from having to configure boilerplate environment scripts:

- **`isBrowser` Core Targets:** Mapped automatically for `frontend`, `frontend-plugin`, `frontend-plugin-module`, and `web-library`. Automatically sets Vitest to boot in a **JSDOM** sandbox and pulls down browser-specific lint rulesets.
- **`isServer` Core Targets:** Mapped automatically for `backend`, `backend-plugin`, `backend-plugin-module`, `node-library`, `cli`, and `cli-module`. Sets Vitest to a native, high-speed **Node** execution loop and enables server-side runtime validations.

### 🛡️ Resilient Process & Type Architecture

The toolbelt architecture is constructed following modern, deterministic execution patterns:

- **Decoupled Entrypoints:** `index.ts` files act strictly as lightweight declarative shells. All business rules, process spawning pipelines, and validation steps reside in pure, decoupled modules (`lib/orchestrate.ts` or `lib/sync.ts`).
- **Safe Exit Code Trapping:** The codebase enforces a strict **no-process-exit** layout policy. Subprocesses mutate `process.exitCode` natively and return control back to the event loop gracefully. This allows streams to finish draining and avoids abruptly halting asynchronous execution queues.
- **Deterministic Execution & Fail-safes:** If a child process is forcefully killed or timed out by a CI agent (yielding a `null` exit status), the orchestrator intercepts the signal and forces an exit status of `1` instead of leaking a false zero success code.
- **Extension-Free Resolution:** Clean TypeScript module boundaries are maintained throughout. Suffix paths like `.js` inside source file imports have been completely eliminated.
- **Backstage Ecosystem Shimming:** To support testing suites relying on upstream Backstage utility libraries (which look for native Jest testing hooks), the `test-unit` engine automatically mounts a global compatibility layer mapping `globalThis.jest` hooks directly to highly performant native Vitest vectors (`vi.fn()` and `vi.spyOn()`).

## 🛠️ The Global Command Matrix

Run any command using `workbench <command>` from within a package folder, or target it globally through Turborepo. All native command flags are transparently passed down directly to the underlying compiler engines:

```bash
# Examples of transparent flag forwarding
workbench typecheck --watch
workbench test:unit --update
workbench lint --fix
```

| Sub-command                   | Purpose                                                                       | Cache Policy              |
| ----------------------------- | ----------------------------------------------------------------------------- | ------------------------- |
| **`workbench clean`**              | Clears local caching matrices and `dist/` folders safely with root guards.    | Cache Bypass              |
| **`workbench build`**              | Wraps backstage-cli package compilation rules.                                | Cacheable (`dist/**`)     |
| **`workbench format`**             | Run automated text style formatting across the workspace layout via Prettier. | Cacheable                 |

`workbench image:build` removes temporary build directories and attempts to prune
dangling images after each build. Image-prune failures, including images in use
by containers, are reported as warnings and do not change the build or push
result. Images and containers are not force-removed.

## 💻 Local CLI Development Workflow

When actively refactoring or changing the CLI package itself, Vitest and `tsx` bypass the `dist/` compilation loop entirely to let you validate source files instantly from the live, raw `src/` tree with no stale cache leakage:

### Execute unit and integration tests against local raw TypeScript source files

```bash
yarn turbo run test:unit --filter=@ai-crew-suite/workbench-cli
```

### Run local code-coverage metric scans against the CLI package

```bash
yarn turbo run test:unit:coverage --filter=@ai-crew-suite/workbench-cli
```

### Compile changes fresh using Rollup

```bash
yarn turbo run build --filter=@ai-crew-suite/workbench-cli
```

## 🧩 Shared Config Subpath Exports

This toolkit exposes zero-boilerplate configuration hooks directly to the monorepo ecosystem. For example, your master root-level configuration maps straight to the CLI's internal compiled code vectors using Yarn Workspaces link aliases:

```typescript
// eslint.config.js (At Monorepo Root)
import { createFlatConfigForWorkspace } from '@ai-crew-suite/workbench-cli';

export default createFlatConfigForWorkspace();
```

## Extend Vitest config in a repo

Extending the shared workbench-cli Vitest config from a consuming package's local `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import { createCrewVitestConfig } from '@ai-crew-suite/workbench-cli';

export default defineConfig(
  createCrewVitestConfig({
    test: {
      name: 'lint-architecture-custom-override',
    },
  }),
);
```

## 🛟 Self-Linting Special Exception

Because a node package cannot safely invoke its own uncompiled workspace binary hook while running clean cycles on its own files, the CLI uses a localized direct file pointer to trigger its code validation passes:

```json
"scripts": {
  "lint": "node ./dist/bin/crew.js lint"
}
```

### Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.
Licensed under the **Apache License, Version 2.0**.


## 🔌 Consumer Integration Guide (How the CLI Uses External Fixtures)

Downstream CLI orchestrators can pull these configurations cleanly out of memory fields:

```typescript
import { getAllProgrammaticMappings, getAllProgrammaticVendorPayloads } from '@ai-crew-suite/fixtures-external';

// Programmatically feed interceptor networks
const mappings = getAllProgrammaticMappings();
console.log(`Successfully hydrated ${mappings.length} structural mock routes.`);
```
