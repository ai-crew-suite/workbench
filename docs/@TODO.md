# @TODOs

The friction you are feeling is completely valid. Unit testing frameworks like **Vitest should never block on heavy infrastructure tasks like building Docker images.** This breaks the core philosophy of Turbo (which relies on declarative, cacheable task pipelines) and ruins the local developer inner loop due to timeouts.

Moving to a decoupled **Build → Registry → Test** pipeline is exactly the right architectural move.

Here is how to structure this cleanly across Turbo, your local Zot registry, and CI, while ensuring Turbo can perfectly cache everything.

## 1. The Core Architecture: Task Splitting

You need to break your current workflow into two distinct Turbo tasks in your `turbo.json`:

1. `build:image`: Compiles the Dockerfile and pushes it to a registry (Zot locally, Artifact Registry/ECR in CI).
2. `test:image`: Pulls the already-built image from the registry and runs Container Structure Tests (CST).

By splitting these, **Turbo can cache the `build:image` task perfectly.** If the source code for the image hasn't changed, Turbo will hit the cache, skip the Docker build entirely, and immediately hand the pre-built image tag to your test runner.

## 2. Configuring `turbo.json`

You must declare the dependency relationship so Turbo knows it cannot test an image until it has been built and pushed.

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

*Note: Because Docker builds happen outside the local `node_modules` or `dist` folders, we leave `outputs` empty. Turbo will cache the \*successful completion\* of the build based on the `inputs`.*

## 3. Dynamic Tagging Strategy (Local vs. CI)

To make this work seamlessly, your build and test scripts need to dynamically know *where* to push and pull from. Use an environment variable like `REGISTRY_URL` and a generic tag like `test-local` or the Git SHA in CI.

### The Build Step (`package.json` script)

Instead of forcing Vitest to trigger the build, use a shell script or a lightweight Node script invoked by Turbo:

```bash
# Example build:image script
# Default to your local Zot registry if REGISTRY_URL isn't set
REGISTRY="${REGISTRY_URL:-localhost:5000}"
IMAGE_TAG="${IMAGE_TAG:-test-local}"

docker build -t $REGISTRY/workbench-tool:$IMAGE_TAG .
docker push $REGISTRY/workbench-tool:$IMAGE_TAG
```

### The Test Step (`package.json` script via CST)

Since you are using Google’s **Container Structure Test (CST)**, you don't even need Vitest for this specific layer. CST is a binary designed to run directly against a registry or local daemon image.

```bash
# Example test:image script
REGISTRY="${REGISTRY_URL:-localhost:5000}"
IMAGE_TAG="${IMAGE_TAG:-test-local}"

# 1. Pull the image to ensure we have the cached version from the registry
docker pull $REGISTRY/workbench-tool:$IMAGE_TAG

# 2. Run Google's CST directly against the pulled image
container-structure-test test \
  --image $REGISTRY/workbench-tool:$IMAGE_TAG \
  --config cst-config.yaml
```

## 4. Refining the Workflows

### 💻 Local Dev Workflow

1. You run `npx turbo test:image`.
2. Turbo checks if the `Dockerfile` or `src` changed.
3. **If changed:** Turbo runs `build:image`, builds the Docker file, and pushes it to your local **Zot** registry (`localhost:5000/workbench-tool:test-local`).
4. Turbo then runs `test:image`, which pulls from Zot and executes CST.
5. **If NOT changed:** Turbo instantly replays the `build:image` log from cache, skips the build, and jumps straight to `test:image`.

### 🚀 CI Workflow (GitHub Actions, GitLab, etc.)

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

Why this is better:

- **Vitest is liberated:** Vitest goes back to doing what it does best—lightning-fast, pure JS/TS unit utilities, completely separated from Docker lifecycles.
- **Zero Timeout Issues:** CST runs instantly once the image is pulled.
- **Native Turbo Caching:** You stop fighting Turbo's caching mechanism and start leveraging it to skip redundant image compilations.

Yes, **this is the industry-standard way to manage container life cycles.**

In fact, avoiding the use of mutable tags like `latest` or `dev` during the testing phase prevents a massive anti-pattern: **race conditions in CI/CD**. If two PRs are running tests at the same time and both overwrite a single `latest` or `test-local` tag, they will pull each other's images and break the tests. Tagging by **Git SHA** guarantees absolute isolation.

Here is why your proposed two-step lifecycle is highly effective, along with the standard way to implement step 2 (moving the tag) without rebuilding the image.

## Step 1: The Git SHA Push (Completely Normal)

Every time a commit is pushed, your CI builds the image and tags it with the unique Git SHA (e.g., `workbench-tool:a1b2c3d`).

- This image represents a immutable "build artifact" that can be safely pulled, audited, and tested.
- Turbo can easily track this because the Git SHA can be passed as an environment variable or input.

## Step 2: Promoting to `latest` (The Right Way)

When the PR merges to `main`, or your local CLI finishes a successful deployment, you want to point the `latest` tag to that specific SHA.

**Crucial Insight:** You should **never** rebuild the Docker image to update the tag. Rebuilding introduces risk (base image updates, dependency shifts) and wastes time. Instead, you perform a **Registry-Level Retag**.

### Option A: The Docker CLI Method (Fast & Local-Friendly)

If you already have the image pulled locally or on your CI runner, updating the tag takes less than a second:

```bash
# 1. Pull the verified SHA image (if not already present)
docker pull my-registry/workbench-tool:$COMMIT_SHA

# 2. Add the 'latest' alias locally
docker tag my-registry/workbench-tool:$COMMIT_SHA my-registry/workbench-tool:latest

# 3. Push just the new pointer to the registry
docker push my-registry/workbench-tool:latest
```

*Note: Because Docker uses content-addressable storage (layer hashes), Step 3 doesn't actually upload any data. It simply tells the registry: "Point the `latest` label to the layers that already exist for this SHA."*

### Option B: The Registry API Method (Ultra-Fast for CI)

In a remote CI environment (like [GitHub Actions](https://github.com/actions) merging to `main`), pulling and pushing gigabytes of data just to change a tag is wasteful. Tools like Google’s `crane` or `regctl` allow you to retag an image **directly inside the registry** over an API call without downloading a single layer:

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