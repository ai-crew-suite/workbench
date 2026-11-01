# @TODOs

Right now, the Compose stack is running, but neither a backend nor a frontend dev server is recorded as running for this repository. Nothing is listening on their default ports, 7007 and 3000. Grafana is listening on 3001.

`--filter=@ai-crew-suite/workbench-backend` starts the stack and the backend only, normally at `http://localhost:7007`. A healthy Compose stack alone doesn’t establish that the backend finished starting.

`--filter=@ai-crew-suite/workbench-app` starts the stack and the frontend only, normally at `http://localhost:3000`. It does not start the backend. Both are foreground dev servers; stopping a command leaves the Compose stack running.

The second command’s Compose output is expected under the current implementation: it reads the PID state but still runs `docker compose up -d --wait` to reconcile the stack. That does not necessarily mean containers were restarted; I can’t determine that from the output described. See `runner.ts` and `cluster.ts`.

Your proposed single-stack behavior differs from today’s design: `state.ts` derives a separate state directory and Compose project name from each repository path. The JSON already records the repository’s root path, but another repository looks in a different state directory and won’t consult it. A shared state location and lock, plus an owner/repository label for the message, would support the behavior you described.

## Break  current unit test workflow into two distinct Turbo tasks in `turbo.json`

1. `build:image`: Compiles the Dockerfile and pushes it to a registry (Zot locally, Artifact Registry/ECR in CI).
2. `test:image`: Pulls the already-built image from the registry and runs Container Structure Tests (CST).

By splitting these, **Turbo can cache the `build:image` task perfectly.** If the source code for the image hasn't changed, Turbo will hit the cache, skip the Docker build entirely, and immediately hand the pre-built image tag to your test runner.

1. The `image:publish` command should check the current staging, and fail with a message "Please commit your current changes, the image needs a good commit SHA hash to reliably identify it" or similar.
2. Need to add something like a `image:promote` to add a `latest` tag to the image for the current SHA.
3. Need to add logic to the `deploy/containers` package vitest units to pull the image for the current SHA, instead of building it. It would need to check the working directory also to see if there's uncommitted changes.

### Configuring `turbo.json`

Declare the dependency relationship so Turbo knows it cannot test an image until it has been built and pushed.

```json
{
  "$schema": "https://turbo.build",
  "tasks": {
    "build:image": {
      "inputs": ["Dockerfile", "src/**/*", "package.json"],
      "outputs": [] 
    },
    "test:image": {
      "dependsOn": ["build:image"],
      "inputs": ["cst-config.yaml"],
      "outputs": []
    }
  }
}
```

Because Docker builds happen outside the local `node_modules` or `dist` folders, we leave `outputs` empty. Turbo will cache the successful completion of the build based on the `inputs`.

### CI Workflow (GitHub Actions, GitLab, etc.)

In your CI pipeline, you spin up a ephemeral registry or use a "dev/staging" namespace in your cloud registry.

```yaml
# Example CI Step
- name: Run Image Tests
  run: npx turbo test:image
  env:
    REGISTRY_URL: gcr.io/my-project-dev
    IMAGE_TAG: ${{ github.sha }}
```

Because Turbo supports **Remote Caching**, if a coworker already built and tested that exact commit SHA, your CI will complete the entire test suite in seconds without ever building a single Docker layer.

## Step 1: The Git SHA Push

Every time a commit is pushed, your CI builds the image and tags it with the unique Git SHA (e.g., `workbench-tool:a1b2c3d`).

- This image represents a immutable "build artifact" that can be safely pulled, audited, and tested.
- Turbo can easily track this because the Git SHA can be passed as an environment variable or input.

## Step 2: Promoting to `latest`

When the PR merges to `main`, or your local CLI finishes a successful deployment, you want to point the `latest` tag to that specific SHA.

**Crucial Insight:** You should **never** rebuild the Docker image to update the tag. Rebuilding introduces risk (base image updates, dependency shifts) and wastes time. Instead, you perform a **Registry-Level Retag**.

#### Option A: The Docker CLI Method (Fast & Local-Friendly)

If you already have the image pulled locally or on your CI runner, updating the tag takes less than a second:

```bash
# 1. Pull the verified SHA image (if not already present)
docker pull my-registry/workbench-tool:$COMMIT_SHA

# 2. Add the 'latest' alias locally
docker tag my-registry/workbench-tool:$COMMIT_SHA my-registry/workbench-tool:latest

# 3. Push just the new pointer to the registry
docker push my-registry/workbench-tool:latest
```

Because Docker uses content-addressable storage (layer hashes), Step 3 doesn't actually upload any data. It simply tells the registry: "Point the `latest` label to the layers that already exist for this SHA."

#### Option B: The Registry API Method (Ultra-Fast for CI)

Tools like Google’s `crane` or `regctl` allow you to retag an image **directly inside the registry** over an API call without downloading a single layer:

```bash
# Using 'crane' (works flawlessly with standard OCI registries like Zot, GCR, ECR, etc.)
crane tag my-registry/workbench-tool:$COMMIT_SHA latest
```

### Integrating this into your CLI/Workflow

For your **Local CLI** tool or your **`main` branch CI script**, the sequence looks like this:

1. **Trigger:** PR Merges to `main` (or user runs `my-cli promote`).
2. **Resolve SHA:** Grab the current Git SHA (`git rev-parse --short HEAD`).
3. **Retag:** Execute the `docker tag` or `crane tag` command to stamp `latest` onto that SHA.

This creates a clean, predictable promotion pipeline: **Build SHA** \(\rightarrow \) **Test SHA** \(\rightarrow \) **Promote SHA to Latest**.