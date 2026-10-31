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

The code generator and Compose start/stop implementations are unfinished and
are not registered as commands. The generator and Compose start sources are
excluded from this package's TypeScript build until they are complete.

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
