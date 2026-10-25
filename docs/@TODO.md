# Todos for Workbench Repo



- CSpell is adding new words to `.vscode/settings.json` CSpell key instead of the root `cspell.json` file. This is probably a common issue across all repos.
- Move BASH scripts in `packages/deploy/containers/scripts` to CLI scripts
- Move CLI commands into Crew CLI

## Build Errors

## Two follow-ups worth knowing (pre-existing, not caused by this fix)

1. __Runtime entry mismatch__: the backend now builds to Backstage's new bundle format (`dist/bundle.tar.gz` + `dist/skeleton.tar.gz`), but the Dockerfile's runtime CMD is `node packages/backstage/backend/dist/index.js --config packages/backstage/backend/skeleton/empty-fallback.yaml` — no such file is produced, and `skeleton/` isn't copied into the runtime stage. The image builds, but the container likely won't boot as-is; your new `__tests__/backend.spec.ts` (expects port 7007) and `backend.yaml` (asserts `/app/.../dist/index.js`) will surface this when you run `image:test:structure`/`test:unit`. Deciding how to boot the bundle-format backend is a design choice I didn't make unilaterally.
2. The fixtures' `dist/index.js` is ESM (`module: ESNext`) with no `"type": "module"` — fine for the bundle/rollup flow, but it would break anything requiring it as CommonJS from `dist` directly.
