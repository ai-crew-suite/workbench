# Backstage Frontend Server for Dev and CI

> 🎨 **Modern Frontend Application scaffolding, wrapper container, and isolated UI component testing playground for the AI Crew Suite platform.**

This workspace package provides a zero-config, isolated web execution profile for modern Backstage application frontends. It allows standalone UI/UX plugin repositories across our organization to pull down a uniform wrapper shell as a `devDependency` and instantly stand up a hot-reloaded browser interface.

## 🛠️ Design & Motivation

Unlike classic production deployments that bundle large monolithic routing configurations directly inside single packages, this utility framework handles plugin isolation dynamically at the calling site.

### The `skeleton/` Directory Strategy

The Backstage CLI (`@backstage/cli package start`) enforces compile-time asset requirements (like an un-linked `index.html` DOM entry mount or pathing `tsconfig.json` configurations). 

To prevent teams from copy-pasting this infrastructure into every project repository, this shared package houses a centralized **`skeleton/` directory**. At runtime, our binary launcher hooks these assets natively into the calling path, enabling the Backstage engine to watch local code mutations without requiring custom repository-level configuration maps.

### The `dev/index.tsx` Core Injection Pattern

To remove complex and brittle path mapping aliases inside your build tools, this orchestrator employs a **Static Injection Blueprint**. Consuming plugins declare a lightweight `dev/index.tsx` file inside their local workspaces. This module automatically loads our initialization hooks and injects the raw plugin layouts directly into the React context layer out of the box.

## 🏗️ Core Responsibilities

- **Unified Shell Initialization**: Automates browser application scaffolding via custom `bootstrapFrontendWorkbench` wrappers.
- **Enterprise UI Guarding**: Embeds global development features—such as our customized `DevErrorBoundary` overlay—to catch render exceptions gracefully during inner-loop hot-reloads.
- **Zero-Config Developer Loop**: Automatically configures the Backstage CLI bundler to look straight back at local development targets dynamically.

## 📈 Local Engine Maintenance (This Package)

These commands are for maintaining, linting, and running tests on this wrapper orchestrator library inside our core system platform repository.

### Running Lint

To trigger the Crew CLI provided ESLint configuration, execute:

```bash
yarn turbo run lint --filter=@ai-crew-suite/workbench-frontend
```

### Running Unit Test Suites

To trigger a `tsc` typecheck run, execute:

```bash
yarn turbo run typecheck --filter=@ai-crew-suite/workbench-frontend
```

### Running Unit Test Suites

To trigger the underlying Vitest engine under a simulated DOM environment (`jsdom`), execute:

```bash
yarn turbo run test:unit --filter=@ai-crew-suite/workbench-frontend
```

## 🔌 Consumer Integration Guide (How Plugins Use This)

Follow this checklist to configure zero-config local boot loops inside a standalone frontend plugin repository.

### 1. Update the Plugin's `package.json`

Declare the shared orchestrator utility inside your dependencies tree and bind the start execution script:

```json
{
  "name": "@ai-crew-suite/plugin-custom-view-frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "backstage-dev-app"
  },
  "devDependencies": {
    "@ai-crew-suite/workbench-frontend": "workspace:*"
  }
}
```

### 2. Establish the Standard `dev/` Entry Point

Create a new directory at `dev/` and write a clean, statically typed pass-through script into `dev/index.tsx`:

```tsx
// dev/index.tsx
import { bootstrapFrontendWorkbench } from '@ai-crew-suite/workbench-frontend';
import { RootPage } from '../src/index';

// Boot the centralized corporate shell matrix using your local view component
bootstrapFrontendWorkbench(RootPage);
```

### 3. Export Your UI Layer Component Natively

Ensure your component entry file (`src/index.tsx`) exposes its primary viewing panel as a clean named export matching your initialization target:

```tsx
// src/index.tsx
import React from 'react';

export const RootPage = () => {
  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Custom Workspace Active</h1>
      <p>Your isolated plugin component is rendering cleanly inside the platform shell container.</p>
    </div>
  );
};
```

### 4. Boot up the Hot-Reloaded App Server

To spin up your isolated local web server instance, run:

```bash
LOG_LEVEL=debug yarn turbo run start --filter=@ai-crew-suite/testpad-frontend
```

## 📄 Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.
Licensed under the **Apache License, Version 2.0**.
