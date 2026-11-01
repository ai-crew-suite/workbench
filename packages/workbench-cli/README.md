# Workbench Backstage CLI module

`@ai-crew-suite/cli-module-workbench` adds workbench commands to the
Backstage CLI. Add it and `@backstage/cli` to the **root** dependencies or
devDependencies of a Backstage monorepo. Keep `@backstage/cli-defaults` if
the standard Backstage commands are also needed.

```json
{
  "devDependencies": {
    "@ai-crew-suite/cli-module-workbench": "<version>",
    "@backstage/cli": "<version>",
    "@backstage/cli-defaults": "<version>"
  }
}
```

Backstage discovers packages with the `cli-module` role from the root
manifest. Commands can then be run from the root or a child workspace:

```sh
yarn backstage-cli workbench --help
yarn backstage-cli workbench image build --help
yarn backstage-cli workbench compose lint packages/deploy/compose
```

This repository's Workbench-specific child workspace scripts use
`yarn run -T backstage-cli` to resolve the root CLI. Other workspace scripts
use `backstage-cli crew` and require the Crew CLI module in the root manifest.
The module also provides the standalone
`backstage-cli-module-workbench` binary, with the same `workbench` command
group.

## Commands

| Command | Purpose |
| --- | --- |
| `workbench code-generator <plugin-id>` | Generate and register a Backstage plugin or module. |
| `workbench compose lint [target]` | Lint Compose files. |
| `workbench compose publish` | Publish the Compose configuration as an OCI artifact. |
| `workbench compose start` | Start or reconcile the shared Compose stack. |
| `workbench compose stop` | Stop the shared Compose stack. |
| `workbench image build [target]` | Build container images. |
| `workbench image lint [target]` | Lint Dockerfiles. |
| `workbench image publish [target]` | Publish container images. |
| `workbench image test security [target]` | Scan images with Trivy. |
| `workbench image test structure [target]` | Run container structure tests. |
| `workbench wiremock seeder [source]` | Seed WireMock using fixtures or a JSON file. |

Use `--help` on each command for options and environment variables. A `.env`
file at the Backstage repository root is loaded when a workbench command runs;
existing environment variables take precedence.

Image builds clean temporary build directories and attempt to prune dangling
images. Prune failures are reported as warnings and do not change the build
result. Images and containers are not force-removed.

## Compose development stack

Docker with Compose support and Yarn must be available on `PATH`. Run these
commands from a repository containing `backstage.json`:

```sh
yarn backstage-cli workbench compose start
yarn backstage-cli workbench compose stop
```

These commands manage infrastructure only. Start and stop frontend and backend
development servers independently from their own directories.

The first start retrieves the Compose artifact from
`ghcr.io/ai-crew-suite/workbench-compose:latest` by default, then runs
`docker compose up -d --wait`. Use `--registry` and `--tag` (or `REGISTRY` and
`IMAGE_TAG`) to select another artifact; loopback registries use HTTP
automatically, and `--plain-http` enables HTTP for other registries. OCI pulls
use username/password entries in Docker's config (`DOCKER_CONFIG` or
`~/.docker/config.json`); Docker credential helpers and identity tokens are
not supported. Layer digests are checked, but artifact signatures are not
verified. Published Compose configuration is executed by Docker: only use
artifacts from registries and publishers you trust.

Each OS user has one managed stack across their repositories. Starting again
from its owning repository reconciles that stack; starting from a different
repository reports the owner and refuses to start another. Any repository may
stop it. A stack is bound to the Docker daemon on which it was started; switch
back to that daemon before starting or stopping it. Stop retains named volumes
and does not stop development servers. If teardown fails, fix the error and
retry the command.

The cached Compose file and `workbench.pid` state file are stored in the user's
private `~/.workbench-compose` directory. They record the repository, Docker
daemon, and artifact reference, not registry credentials. The state must remain
available until teardown completes. To change the artifact reference or registry
transport, stop the existing stack first. A previous repository-scoped stack is
detected and must be stopped before a new shared stack can start. If multiple
older stacks or missing state are reported, stop those projects individually
using their original Compose project and configuration. Upgrade older CLI
installations as well; they do not participate in the shared lock.

## Plugin generator

The generator supports `frontend-plugin`, `frontend-plugin-module`,
`backend-plugin`, and `backend-plugin-module`:

```sh
yarn backstage-cli workbench code-generator example --type frontend-plugin
yarn backstage-cli workbench code-generator example --type backend-plugin-module \
  --module-id extra --plugin-package @example/plugin-example-backend \
  --scope @example --path plugins/backend/example-extra
```

`--type` is required. Module templates also require `--module-id` and
`--plugin-package`, the parent plugin's package name. IDs must be lowercase
and dash-separated. `--scope` defaults to `@ai-crew-suite`; `--path` selects
an output directory inside the repository. Without `--path`, frontend
packages are placed under `plugins/frontend` and backend packages under
`plugins/backend`. `--dry-run` renders the template and validates registration
without changing the consumer repository.

The repository must have `backstage.json`, a root `package.json` with a
workspaces array, and a JSON `tsconfig.json` with a references array. It must
also have the relevant `packages/app` or `packages/backend` manifest and a
conventional runtime entrypoint: the frontend uses `createApp({ features: [...] })` from
`@backstage/frontend-defaults` in `packages/app/src/App.tsx`; the backend
uses `const backend = createBackend()` and `backend.start()` in
`packages/backend/src/index.ts`. Unsupported layouts fail rather than being
rewritten.

The generator adds the workspace, TypeScript reference, host dependency, and
runtime feature registration. It does not configure repository-specific
ESLint overrides or install dependencies; configure linting for the generated
role as required by your repository and run `yarn install`. If a write fails,
registration edits are rolled back where possible; generated files may remain
and should be inspected before removal.

## Development and publishing

```sh
yarn workspace @ai-crew-suite/cli-module-workbench typecheck
yarn workspace @ai-crew-suite/cli-module-workbench test:unit
yarn workspace @ai-crew-suite/cli-module-workbench build
```

The module depends on `@ai-crew-suite/fixtures-external` and
`@ai-crew-suite/fixtures-kubernetes` for WireMock seeding. Build and publish
those packages before publishing the CLI module; their published entrypoints
use compiled JavaScript. The CLI's build generates declarations and uses
`backstage-cli package build` to create the distributable module.

Copyright 2026 The AI Crew Suite Authors. Licensed under Apache-2.0.
