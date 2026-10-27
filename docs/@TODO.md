# Todos for Workbench Repo



- CSpell is adding new words to `.vscode/settings.json` CSpell key instead of the root `cspell.json` file. This is probably a common issue across all repos.
- Move BASH scripts in `packages/deploy/containers/scripts` to CLI scripts
- Move CLI commands into Crew CLI

### Changes made

- **Compose workspace layout**
  - Consumer `--project-directory` mounts at `/app`.
  - Backend-only runs in `/app/.`.
  - Paired repositories run in `/app/backend` and `/app/frontend`.
  - Both commands default to `yarn start` in the plugin directory.
  - Removed anonymous `/app/node_modules` volumes, so the mounted root dependencies are used directly.
  - Frontend is behind the `frontend` profile, preventing backend-only stacks from requiring a frontend directory.

- **Development images**
  - Removed compilation stages, dependency focusing, source copying, and baked `node_modules`.
  - Both images are now lightweight Node 22 runners with Yarn/Corepack and Tini.
  - Both default to `yarn start`.
  - Removed skeleton generation from `packages/deploy/containers/scripts/build.sh`.
  - Containers explicitly run as root because host bind mounts are root-mapped in this Docker environment; this allows generated files and dependency updates to write to the mounted workspace.

- **External package compatibility**
  - Added `src/` to both workbench packages’ published files. Previously, package dry-runs omitted imported TypeScript modules required by the launchers.
  - Updated the frontend testpad with `backstage.role: frontend-plugin` and the current `backstage-dev-frontend` launcher.
  - Corrected its repository directory metadata.

### Consumer configuration

Backend-only `.env`:

```dotenv
COMPOSE_PROFILES=""
BACKEND_PLUGIN_DIR="."
```

Backend and frontend in a common root:

```dotenv
COMPOSE_PROFILES="frontend"
BACKEND_PLUGIN_DIR="backend"
FRONTEND_PLUGIN_DIR="frontend"
```

Each plugin package provides its own `start` script.

### Validation completed

- Both Compose layouts validated with layout/mount assertions.
- Both Docker images built successfully.
- **2/2** container integration tests passed.
- **16/16** container-structure checks passed.
- Hadolint, TypeScript, shell syntax, and diff checks passed.
- Frontend mounted-plugin `yarn start` smoke test reached **`Rspack compiled successfully`**.
- Backend mounted-plugin smoke test successfully loaded plugin TypeScript and began listening on port 7007.

### Remaining blocker

Backend initialization currently fails in TechDocs because:

```text
ReferenceError: __dirname is not defined
```

The source is `/home/kevin/Repos/ai-crew-suite/workbench/packages/fixtures/techdocs/src/index.ts:24`.

This needs an ESM/CJS-compatible package-asset path resolution strategy, tested in both dynamic TypeScript development and compiled distribution modes. It is separate from the container/mount implementation, but currently prevents the backend from becoming fully healthy.
