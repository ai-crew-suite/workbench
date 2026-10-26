# Todos for Workbench Repo



- CSpell is adding new words to `.vscode/settings.json` CSpell key instead of the root `cspell.json` file. This is probably a common issue across all repos.
- Move BASH scripts in `packages/deploy/containers/scripts` to CLI scripts
- Move CLI commands into Crew CLI

## Runtime entry mismatch

The backend now builds to Backstage's new bundle format (`dist/bundle.tar.gz` + `dist/skeleton.tar.gz`), but the Dockerfile's runtime CMD is `node packages/backstage/backend/dist/index.js --config packages/backstage/backend/skeleton/empty-fallback.yaml` — no such file is produced, and `skeleton/` isn't copied into the runtime stage. The image builds, but the container likely won't boot as-is; your new `__tests__/backend.spec.ts` (expects port 7007) and `backend.yaml` (asserts `/app/.../dist/index.js`) will surface this when you run `image:test:structure`/`test:unit`. Deciding how to boot the bundle-format backend is a design choice I didn't make unilaterally.

## Diagnosis: why `image:test:unit -- backend` skips the cache and builds everything

>  We have this issue for all test tasks

I reproduced the task plan with `turbo --dry-run` and inspected the cache entries in `.turbo/cache`. The root cause is **two interacting turbo behaviors**, both confirmed as *intended* behavior by the turbo maintainers ([vercel/turborepo#11025](https://github.com/vercel/turborepo/issues/11025)):

**1. Passthrough args after `--` are hashed into \*every\* task in the run — including dependencies that never receive them.**

Proof from your repo (turbo 2.11.10):

| Task                       | Hash without args  | Hash with `-- backend` |
| :------------------------- | :----------------- | :--------------------- |
| `image:build` (dependency) | `66d1b8c4747980d4` | `432e06e0429f4e43`     |

The dry-run JSON literally shows `"cliArguments": ["backend"]` on the `image:build` task while its command remains `./scripts/build.sh`. CI runs the no-arg form (`yarn turbo run image:test:structure`), and so does the package's `test` script — so the cache partition they populate can **never** be hit by any `-- <target>` run. Every distinct target string (`-- backend`, `-- temporal`, …) is its own cache universe.

**2. Passthrough args are only forwarded to the *requested* task, not its dependencies.**

So `image:build` (a `dependsOn` of `image:test:unit`) runs `./scripts/build.sh` with **no `$1`**, which hits build.sh's fallback: *"🔄 No explicit target provided. Initiating a full structural build cascade..."* — building all 9 images. I confirmed this by decompressing the cached entry `432e06e0429f4e43.tar.zst`: it's a full-cascade build log (~57s), stored under the `backend`-args hash.

**Net effect of `-- backend`:** the worst of both worlds — a full all-image rebuild, filed under a fresh cache key that no prior run can satisfy. (It does get cached after the fact — a repeat of the *identical* command now shows a HIT — but change the target once and you rebuild everything again.)

**Secondary cache-correctness bugs I found (wrong-direction, but real):**

- `image:build` inputs listed `scripts/build-script.sh` and `image:lint` listed `scripts/lint-docker.sh` — **neither file exists** (real names: `build.sh`, `lint.sh`), and no test task listed its own script. So editing the scripts *never* invalidated the cache → stale hits.
- `build.sh` output depends on `REGISTRY` and `IMAGE_TAG` env vars, which weren't tracked — building for a different registry could false-HIT and skip producing the correctly-tagged image.
- Related but separate: `package.json` points `image:test:unit` at `./scripts/test-unit.sh`, **which was never created** (an uncommitted edit changed it from `crew test:unit`) — the task currently fails outright; the last attempt's log shows `crew` rejecting the `backend` arg.
- Notably, the `.spec.ts` files build their own images via Testcontainers (`GenericContainer.fromDockerfile(...).build()`), so `image:test:unit` doesn't strictly need the pre-built images at all.

## What I implemented (the simple, clearly-correct slice)

Edited `/home/kevin/Repos/ai-crew-suite/workbench/packages/deploy/containers/turbo.jsonc` only:

- Fixed all script input globs to reference the **real** files (`scripts/build.sh`, `scripts/lint.sh`) and added each task's own script to its `inputs` (incl. the future `scripts/test-unit.sh`), so script edits now invalidate the cache correctly.
- Added `"env": ["REGISTRY", "IMAGE_TAG"]` to `image:build` so different registry/tag targets can't false-hit.

Validated with `turbo --dry-run=json`: config parses, the new inputs appear in the task hashes, and `REGISTRY`/`IMAGE_TAG` resolve on `image:build`. (Old cache entries won't be reused once — expected, since `turbo.jsonc` is part of every hash.)

## Alternatives for the real fix — let's discuss

The core issue can't be configured away (turbo deliberately hashes args). Options, per the maintainers' suggested workaround ("define separate commands"):

1. **Named per-target tasks (minimal structure change):** e.g. `image:test:unit:backend`, `image:test:unit:temporal` scripts in `package.json` that hard-code the target, with a turbo task pattern. No passthrough args → `image:build` keeps **one stable hash** shared by all variants, so CI/no-arg builds and targeted test runs all reuse the same cached build. Doesn't fix per-image build granularity, though.
2. **Per-image workspace packages (the idiomatic fix):** each `containers/<image>/` becomes its own workspace with its own `image:build`/`image:test:*` tasks and scoped inputs. Targeting then uses `--filter=@ai-crew-suite/container-backend` — and **`--filter` does not affect the cache hash** — giving you true per-image caching (only rebuild what changed). Moderate refactor: 9 packages, script changes, README + CI updates.
3. **Bypass turbo for targeted work:** run `yarn workspace @ai-crew-suite/containers image:test:unit backend` directly (arg reaches the script, docker layer cache makes it cheap), and keep turbo for no-arg full runs only. Cheapest, but loses `dependsOn` on direct runs and needs README updates.

Also worth deciding: whether `image:test:unit` should keep `dependsOn: ["image:build"]` at all, given the specs self-build via Testcontainers (dropping it would make targeted unit tests instant), and the missing `scripts/test-unit.sh` needs implementing either way. Let me know which direction you'd like and I can carry it out.
