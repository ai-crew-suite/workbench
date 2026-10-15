# Backstage Backend Dev Server Workspace Dependency Synchronization Wrapper

This workspace package serves as the centralized backend development server dependency sync matrix for the AI Crew Suite platform. It bundles and standardizes the extensive ecosystem of Backstage core libraries, frontend plugins, and design tokens into a single import target. This ensures all independent plugin directories, localized dev servers, and external repository lifecycles remain perfectly aligned without copy-pasting dependency manifests.

## 🛠️ Overview & Architecture

Managing framework version alignment across a distributed micro-frontend architecture is highly volatile. This package operates as an **upstream dependency anchor**. Instead of individual plugins or sandbox apps declaring separate versions of core Backstage packages, they inherit this centralized layer to eliminate duplicate dependency trees and singleton version collisions.

## 🏗️ Core Responsibilities

- **Unified Version Enforcement**: Hardcodes the target version matrix for all underlying `@backstage/*` packages to prevent API drift across separate code repositories.
- **Collision Mitigation**: Enforces strict module alignment rules to guarantee core singletons (such as React context bounds and API registries) do not instantiate duplicate instances in memory.
- **Zero-Boilerplate Synchronization**: Aggregates frontend and backend plugin sets into single-line package manifests, allowing external workspace slots to pull required lifecycles instantly.
- **Monorepo Compilation Safety**: Provides a singular point of dependency analysis for our Turbo build cache pipeline, speeding up global dependency resolution intervals.

## Backend Dependency List

- **`@ai-crew-suite/utils-wiremock`**: Powers AI Crew Suite sandboxed filesystem mocking and third-party API fetch interceptors.

- **`@backstage/backend-defaults`**: Provisions core structural initialization builders like `DatabaseManager` and `createBackend`.

- **`@backstage/backend-plugin-api`**: Foundational package containing `createServiceFactory`, `coreServices`, and core dependency injection typings.

- **`@backstage/config`**: Provides the core TypeScript interfaces, primitives, and reader classes used to parse and query the static YAML configurations across the entire Backstage system.

- **`@backstage/plugin-auth-backend`: Feeds main identity lifecycle and source-control login routers.

- **`@backstage/plugin-catalog-backend`**: Core engine handling the component registrations and local mock location loops.

- **`@backstage/plugin-catalog-backend-module-logs`**: A specialized diagnostics extension for the modern Backstage software catalog backend framework

- **`@backstage/plugin-catalog-backend-module-scaffolder-entity-model`**: Adds support for the Template entity kind to core Software Catalog backend.

- **`@backstage/plugin-events-backend`**: Establishes the background event bus that coordinates live data updates between tracking plugins.

- **`@backstage/plugin-kubernetes-backend`**: Engine responsible for securely connecting to and querying Kubernetes API control planes.

- **`@backstage/plugin-notifications-backend`**: Hosts the stateful endpoints that fixed `/api/notifications/status` loops.

- **`@backstage/plugin-permission-backend`**: P package provides the centralized authorization server and rule evaluation chassis for the Backstage backend system.

- **`@backstage/plugin-proxy-backend`**: Routes internal plugin network requests out to local developer workspace variables safely.

- **`@backstage/plugin-scaffolder-backend`**: Manages the local template creation tasks and directory tasks.

- **`@backstage/plugin-search-backend`**: Provides the centralized routing engine, query processor, and orchestration framework for the global Search utility on the backend.

- **`@backstage/plugin-search-backend-module-catalog`**: A core background crawler extension (known as a Collator) for the search backend system. It indexes everything inside the Software Catalog (Components, APIs, Resources, Systems, Users, and Groups) and transform that entity data into standardized full-text documents that the search engine can query.

- **`@backstage/plugin-signals-backend`**: Supports real-time WebSocket messaging lanes required by notifications.

- **`@backstage/plugin-techdocs-backend`**: Validates markdown documentation rendering and paths locally.

- **`better-sqlite3`**: The critical engine driving high-speed, isolated `:memory:` thread mappings [packages/backstage/backend/README.md, packages/backstage/backend/src/factory.ts].

- **`yaml`**: Parse YAML files.

## 📄 Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.
Licensed under the **Apache License, Version 2.0**.
