# Backend Dependencies

Here is the breakdown of what is required versus what is cruft:

## Strictly Required Backend Dependencies

These are the operational blocks actively imported and executed by your `factory.ts`, your custom mock isolation modules, or your underlying memory databases `packages/backstage/backend/src/factory.ts`:

- **`@ai-crew-suite/utils-wiremock`**: Powers your sandboxed filesystem mocking and third-party API fetch interceptors [packages/backstage/backend/README.md, packages/backstage/backend/src/factory.ts].
- **`@backstage/backend-defaults`**: Provisions core structural initialization builders like `DatabaseManager` and `createBackend` [packages/backstage/backend/src/factory.ts].
- **`@backstage/backend-plugin-api`**: Foundational package containing `createServiceFactory`, `coreServices`, and core dependency injection typings [packages/backstage/backend/src/factory.ts].
- **`@backstage/plugin-auth-backend` & `@backstage/plugin-auth-backend-module-github-provider`**: Feeds your main identity lifecycle and source-control login routers [packages/backstage/backend/src/factory.ts].
- **`@backstage/plugin-catalog-backend`**: Core engine handling the component registrations and local mock location loops [packages/backstage/backend/src/factory.ts].
- **`@backstage/plugin-events-backend`**: Establishes the background event bus that coordinates live data updates between your tracking plugins [packages/backstage/backend/src/factory.ts].
- **`@backstage/plugin-notifications-backend`**: Hosts the stateful endpoints that fixed your `/api/notifications/status` loops [packages/backstage/backend/src/factory.ts].
- **`@backstage/plugin-proxy-backend`**: Routes internal plugin network requests out to your local developer workspace variables safely [packages/backstage/backend/src/factory.ts].
- **`@backstage/plugin-scaffolder-backend`**: Manages the local template creation tasks and directory tasks [packages/backstage/backend/src/factory.ts].
- **`@backstage/plugin-signals-backend`**: Supports real-time WebSocket messaging lanes required by notifications [packages/backstage/backend/src/factory.ts].
- **`@backstage/plugin-techdocs-backend`**: Validates markdown documentation rendering and paths locally [packages/backstage/backend/src/factory.ts].
- **`better-sqlite3`**: The critical engine driving your high-speed, isolated `:memory:` thread mappings [packages/backstage/backend/README.md, packages/backstage/backend/src/factory.ts].

## Safe to Remove (The Backend Cruft)

### Complete Frontend UI Leaks

The following packages belong strictly to a web browser environment. Your backend factory never reads them, and keeping them here causes massive dependency trees to be downloaded unnecessarily [packages/backstage/backend/src/factory.ts]:

- `@backstage/core-app-api`
- `react`
- `react-dom`
- `react-router`
- `react-router-dom`

### Redundant / Unused Backend Layers

- **`@backstage/plugin-app-backend`**: This is the legacy module we explicitly removed to fix the fatal `Cannot find module 'app/package.json'` boot crash [packages/backstage/backend/src/factory.ts]. It is no longer needed.
- **`@backstage/plugin-permission-backend`**: In modern Backstage App Next, permission checks are evaluated natively by the core framework container. You only need your custom policy (`PermissionModule`) to handle decisions [packages/backstage/backend/src/factory.ts], meaning the root administrative plugin package itself is unused.
- **`@backstage/config`**: Lower-level utility strings already handled natively by your `@backstage/backend-defaults` configurations.
- **`commander`**: Used for building custom command-line interface parameters. Unless your `launcher.js` script grows a large matrix of manual sub-commands, Node's built-in `process.argv` string array is more than enough.

### Unused DevDependencies

- **`@vercel/ncc`**: A compiler tool that bundles a Node.js project into a single file. Since your orchestrator executes **raw source code** directly from `src/index.ts` to support live updates, you are explicitly not using a build step or packing files [packages/backstage/backend/package.json].

## Optimized Lean Backend `package.json`

Here is the exact cleaned specification to apply straight to **`packages/backstage/backend/package.json`**:

```json
{
  "name": "@ai-crew-suite/workbench-backend",
  "version": "1.0.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "bin": {
    "backstage-dev-server": "./launcher.js"
  },
  "dependencies": {
    "@ai-crew-suite/utils-wiremock": "workspace:^",
    "@backstage/backend-defaults": "backstage:^",
    "@backstage/backend-plugin-api": "backstage:^",
    "@backstage/plugin-auth-backend": "backstage:^",
    "@backstage/plugin-auth-backend-module-github-provider": "backstage:^",
    "@backstage/plugin-catalog-backend": "backstage:^",
    "@backstage/plugin-events-backend": "backstage:^",
    "@backstage/plugin-notifications-backend": "backstage:^",
    "@backstage/plugin-proxy-backend": "backstage:^",
    "@backstage/plugin-scaffolder-backend": "backstage:^",
    "@backstage/plugin-signals-backend": "backstage:^",
    "@backstage/plugin-techdocs-backend": "backstage:^",
    "better-sqlite3": "catalog:prod"
  },
  "devDependencies": {
    "@ai-crew-suite/typescript-shared-config": "catalog:dev",
    "@types/node": "catalog:dev",
    "typescript": "catalog:dev",
    "vitest": "catalog:dev"
  }
}
```

## Troubleshooting Notes

All fixed and verified. Here's the full diagnosis and what changed:

## What was actually wrong (3 distinct frontend issues)

I drove your live dev frontend (`:3000`) with a headless browser, dumped the DOM/console/network per route, and found:

1. **No route was bound at `/`** — the URL your browser opens (and the sidebar logo link) fell through to Backstage's NotFound error page: the "sidebar + solid color area" you saw. (Catalog/search/settings actually worked at their direct URLs — you just never got a working entry point to them.)
2. **The scaffolder Create page (`/create`) crashed** with `TypeError: Cannot read properties of undefined (reading 'refs')` inside `@material-ui/styles makeStyles detach` — React 18 **StrictMode double-mounting** is incompatible with the legacy v4 JSS engine that Backstage's core-components/scaffolder pages use. The attach/detach sheet bookkeeping collapses on unmount and the page dies. Your `index.tsx` wrapped the app root in `<React.StrictMode>` — standard Backstage apps never do this (and your repo was already silencing StrictMode-induced MUI warnings right next to it).
3. **`user:default/guest` 404s** — your dev sign-in mints a `user:default/guest` identity, but no such catalog entity existed, so the settings profile card and ownership facet lookups 404'd repeatedly.

The `/api/user-settings/buckets` and `/api/catalog/health` 404s are **red herrings** — no package in this tree emits either URL, and neither appears in any live probe of the current bundle (stale browser session artifacts). And `/api/scaffolder/v2/templates` remains 404 by design — the scaffolder frontend lives at `/create`.

## Changes

| File                                              | Change                                                       |
| :------------------------------------------------ | :----------------------------------------------------------- |
| `packages/backstage/app/src/index.tsx`            | Removed the `<React.StrictMode>` wrapper (fixes the `/create` crash), with an explanatory comment |
| `packages/backstage/app/src/App.tsx`              | Added a `home-redirect` `PageBlueprint` binding `/` → `/catalog` (fixes the blank landing area/logo link) |
| `packages/fixtures/catalog/catalog-info.yaml`     | Added the `guest` User entity matching the sandbox identity (fixes the repeated 404s) |
| `packages/fixtures/catalog/catalog-fixtures.yaml` | Prettier formatting fix                                      |

## Verified (headless Chromium against your running dev server)

- `/` → redirects to `/catalog`, full catalog table renders ("All Components (1)")
- `/catalog` → renders, all `entity-facets`/`by-query` calls 200
- `/search` → 19 results
- `/settings/general` → renders, `user/default/guest` now 200
- **`/create` → scaffolder templates page renders and lists the "Offline Hello World" template** — no more crash
- `/custom-feature` → testpad landing renders
- **Zero JS errors on every route**
- `yarn workspace @ai-crew-suite/workbench-app run typecheck` / `test:unit` pass; fixture lint formatted

## One thing on your side

Your frontend dev server picked up the fixes via HMR, but do a **hard refresh** in your browser (Ctrl+Shift+R) to be sure you're off the old StrictMode bundle, and **restart your backend** (or wait for the catalog refresh cycle) so it ingests the new `guest` fixture. I killed my temporary backend instance; your frontend server on :3000 is still running untouched.

## Root cause

In this Backstage release's new frontend system, `AppNav` renders a __custom NavContent component raw__ — the framework's own `DefaultNavContent` wraps items in the legacy `<Sidebar>` (from `@backstage/core-components`, which provides `position: fixed` overlay behavior), but a custom NavContent is expected to render that wrapper itself. Your `CustomSidebarNav` rendered a plain `<Box>` instead, which caused exactly what you saw:

1. The nav Box flowed __in-document__ instead of being a fixed overlay.
2. This release's `SidebarPage` implementation pads the page left by the pinned-sidebar width (224px) — that was your __"vertical column to the left of the sidebar, the width of the expanded sidebar"__ (it's `padding-left`, meant to be occupied by the fixed sidebar).
3. Sitting in-flow at x=224 with `height: 100vh`, the nav Box pushed __every page's content to y=720+ — below the viewport__ — where the app theme wrapper's `overflow: hidden` clipped it. The content was always in the DOM (your inspector showed it) but off-screen; the "solid color" was just the empty background.

## Fix (`packages/backstage/app/src/plugins/nav/plugin.tsx`)

- Wrapped the custom nav content in `<Sidebar>` from `@backstage/core-components` — it now renders as the fixed-position drawer overlay with the proper navigation background, occupying the page's reserved left padding.
- Replaced the local `useState` expand toggle with the sidebar's own `useSidebarOpenState()` (hover/pin driven), so the item labels stay in sync with the drawer width; the header toggle button now calls `toggleSidebarPinState()` (pin = keep drawer open).
- Removed the Box's self-managed width/height/background/border — the `<Sidebar>` drawer owns those (72px collapsed → 224px expanded/pinned); the Box just fills the drawer.

## Verified (against your running dev server via HMR)

- `typecheck` ✓, `test:unit` ✓ (1/1), `lint` ✓ (0 errors, 2 pre-existing warnings)

- Headless-browser sweep of every route — `/` (→ `/catalog`), `/catalog`, `/search`, `/settings/general`, `/create`, `/custom-feature`:

  - sidebar drawer: `x=0, w=224` (fixed overlay, pinned-open by default)
  - __page content: `x=224, y=0` — visible in the viewport__ on every page
  - SPA click navigation via sidebar links works (`/create` → templates page with the offline template)
  - __zero JS errors__ on every route

No restart needed — your dev servers picked this up via HMR; just hard-refresh the browser tab if it's holding a stale bundle. The sidebar now behaves like native Backstage: hover to expand, and the header toggle button pins/unpins it.

```bash
curl -v "http://localhost:7007/api/user-settings/buckets"
curl -v "http://localhost:7007/api/catalog/health"
curl -v "http://localhost:7007/api/catalog/entities"
curl -v "http://localhost:7007/api/scaffolder/v2/templates"
curl -v "http://localhost:7007/api/search/query?term=&types%5B0%5D=software-catalog&pageLimit=1"

LOG_LEVEL=debug yarn turbo run start --filter=@ai-crew-suite/testpad-backend > boot.log 2>&1
cat boot.log | grep -i "DynamicFixtureEntityProvider\|catalog"
curl -s http://localhost:7007/api/catalog/locations
```

