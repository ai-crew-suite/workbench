# Env Vars

## Backstage Env Vars

| Environment Variable | Equivalent `app-config.yaml` Mapping | Primary Target |
| --- | --- | --- |
| `APP_CONFIG_app_baseUrl` | `app.baseUrl` | Frontend & Backend |
| `APP_CONFIG_backend_baseUrl` | `backend.baseUrl` | Frontend & Backend |
| `APP_CONFIG_backend_listen_port` | `backend.listen.port` | Backend |

## Standard Variables for Interpolation

Instead of using the rigid prefix structure, the standard practice in the Backstage community is to declare standard, human-readable variables in your `app-config.yaml` using the `${VAR}` syntax.

When the backend boots up, it reads these variables from the host system (often populated via a `.env` file or Kubernetes ConfigMap) and interpolates them before passing the parsed configuration down. The most common standard variables across Backstage deployments include:

### Database Variables (Backend Only)

Used by the backend to connect to your software catalog, scaffolding, and plugin databases:

- `POSTGRES_HOST`  |  `POSTGRES_PORT`
- `POSTGRES_USER`  |  `POSTGRES_PASSWORD`
- `POSTGRES_DB`  (or target specific databases like `CATALOG_DATABASE`, `SCAFFOLDER_DATABASE`)

### Integrations & Authentication (Backend Only)

Used by backend plugins to talk to source code management (SCM) platforms and identity providers:

- `GITHUB_TOKEN` (For GitHub Catalog / Scaffolder integrations)
- `AUTH_GITHUB_CLIENT_ID`  |  `AUTH_GITHUB_CLIENT_SECRET`
- `AUTH_OKTA_CLIENT_ID`   | `AUTH_OKTA_CLIENT_SECRET`
- `AUTH_GITLAB_CLIENT_ID`  |  `AUTH_GITLAB_CLIENT_SECRET`

## Node.js & Framework Level Variables

Because Backstage is built on top of Node.js and uses Express for its core backend, it respects standard platform-level environment flags:

- **`NODE_ENV`**: Set to `production` or `development`. This determines how optimization, logging verbosity, and source mapping are handled across both servers.
- **`PORT`**: Though typically configured via `backend.listen.port`, some deployment archetypes check the standard `PORT` variable to bind the HTTP server.
- **`NODE_OPTIONS`**: Frequently used in production (e.g., `NODE_OPTIONS="--max-old-space-size=4096"`) to manage memory allocations for the backend catalog processing engine.

