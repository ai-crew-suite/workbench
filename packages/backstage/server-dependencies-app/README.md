# Backstage App Dev Server Workspace Dependency Synchronization Wrapper

This workspace package serves as the centralized frontend app development server dependency sync matrix for the AI Crew Suite platform. It bundles and standardizes the extensive ecosystem of Backstage core libraries, frontend plugins, and design tokens into a single import target. This ensures all independent plugin directories, localized dev servers, and external repository lifecycles remain perfectly aligned without copy-pasting dependency manifests.

## 🛠️ Overview & Architecture

Managing framework version alignment across a distributed micro-frontend architecture is highly volatile. This package operates as an **upstream dependency anchor**. Instead of individual plugins or sandbox apps declaring separate versions of core Backstage packages, they inherit this centralized layer to eliminate duplicate dependency trees and singleton version collisions.

## 🏗️ Core Responsibilities

- **Unified Version Enforcement**: Hardcodes the target version matrix for all underlying `@backstage/*` packages to prevent API drift across separate code repositories.
- **Collision Mitigation**: Enforces strict module alignment rules to guarantee core singletons (such as React context bounds and API registries) do not instantiate duplicate instances in memory.
- **Zero-Boilerplate Synchronization**: Aggregates frontend and backend plugin sets into single-line package manifests, allowing external workspace slots to pull required lifecycles instantly.
- **Monorepo Compilation Safety**: Provides a singular point of dependency analysis for our Turbo build cache pipeline, speeding up global dependency resolution intervals.

## DEPENDENCY TODOs

- `@backstage/plugin-org` needs wired into the dashboard
- `@backstage/plugin-signals` needs setup on the frontend or removed as a dependency
- `@backstage/plugin-techdocs` needs added to `App.tsx`

## Required Core Dependencies

These packages are explicitly imported and called by your entry points, routing factories, and custom sidebar engine layers:

- **`@backstage/frontend-defaults`**: Provisions `createApp`.

- **`@backstage/frontend-plugin-api`**: Provisions `createFrontendModule`, `createExtensionBlueprint`, and core types.

- **`@backstage/plugin-api-docs`**: Renders the API documentation explorer tab (OpenAPI/Swagger specs) inside the Catalog.

- **`@backstage/plugin-app-react`**: Provisions `NavContentBlueprint` and core wrapper types.

- **`@backstage/plugin-app-visualizer`**: Explicitly added to your feature array matrix [packages/backstage/app/src/App.tsx].

- **`@backstage/plugin-catalog`**: Provides the centralized software directory, index view, and entity detail layouts for the entire Backstage platform.

- **`@backstage/plugin-catalog-graph`**: Renders the interactive visual node graph showing how components, systems, and APIs depend on one another.

- **`@backstage/plugin-kubernetes`**: Renders the Kubernetes cluster resource tracker tab, displaying live deployment status, pods, and errors directly inside a Catalog entity view.

- **`@backstage/plugin-notifications`**: Provides the centralized messaging and alerting hub for the developer portal.

- **`@backstage/plugin-org`**: Manages and displays the organization hierarchy web pages (User profiles, Team/Group pages, and ownership arrays).

- **`@backstage/plugin-scaffolder` & `@backstage/plugin-scaffolder-react`**: Renders the Software Templates wizard UI (the form inputs used to create new repositories).

- **`@backstage/plugin-search`**: Provides the core framework for global, full-text search across the entire developer portal.

- **`@backstage/plugin-signals`**: The frontend client connection bundle that establishes a live WebSocket tunnel to the backend to enable real-time UI data updates without refreshing.

- **`@backstage/plugin-techdocs`**: Renders the documentation reading page layouts (Markdown compiled into HTML documents).

- **`@backstage/plugin-user-settings`**: Provides the user profile dashboard and personalization engine for a Backstage application.

- **`@backstage/theme`**: Provisions `themes` mapping properties and the `UnifiedThemeProvider` layout.

- **`@backstage/ui`**: Mandated by the top-level layout css style injection import.

- **`@material-ui/core`**: Legacy MUI v4 required for core plugins that have not yet been upgraded to Blueprint/MUI v5.

- **`@mui/material`**: Material-UI Version 5 for modern Blueprint stylings.

- **`react` & `react-dom`**: Engine runtime layer.

## 📄 Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.
Licensed under the **Apache License, Version 2.0**.
