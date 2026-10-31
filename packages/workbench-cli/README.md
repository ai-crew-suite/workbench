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

This repository's child workspace scripts use `yarn run -T backstage-cli`
to resolve the root CLI. The module also provides the standalone
`backstage-cli-module-workbench` binary, with the same `workbench` command
group.

## Commands

| Command | Purpose |
| --- | --- |
| `workbench compose lint [target]` | Lint Compose files. |
| `workbench compose publish` | Publish the Compose configuration as an OCI artifact. |
| `workbench compose start <app\|backend>` | Start the shared Compose stack and one foreground dev server. |
| `workbench compose stop` | Stop the managed dev servers and shared Compose stack. |
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

Docker with Compose support and Yarn must be available on `PATH`. The consuming
repository must have `backstage.json`, `packages/app`, and
`packages/backend`. Each package needs a `start:dev` script that runs its
actual development server. To start the infrastructure automatically, its
`start` script can invoke `yarn run -T backstage-cli workbench compose start
app` (or `backend`). The orchestrator calls `start:dev`, avoiding recursion.

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

App and backend can be started independently. They share a repository-specific
Compose project and inherit the caller's environment. Stopping either foreground
server does not stop the stack. Run `yarn backstage-cli workbench compose stop`
from the repository to stop both managed servers and the stack; named volumes
are retained. If teardown fails, fix the error and retry the command.

The cached Compose file and fixed-name `workbench.pid` state file are stored in
a private, repository-specific temporary directory. They contain process
identities and the artifact reference, not registry credentials. The state must
remain available until teardown completes. To change the artifact reference
or registry transport, stop the existing stack first.

The code generator is unfinished and is not registered as a command.

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
