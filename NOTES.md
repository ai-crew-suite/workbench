# 🌐 Workbench Planning

## Docker Compose Layers & Anonymous Volume Protection

When mapping local code into a container using bind mounts, your host directory overlays the container file system entirely. If your host machine (Mac/Windows) has local dependencies like `node_modules` or build caches, it will overwrite the container's built dependencies (Linux), causing runtime errors.

### The Anonymous Volume Trick

You can use **anonymous volumes** to isolate and protect specific container subdirectories. Because Docker mounts deeper paths with higher priority, an anonymous volume sits *on top* of your standard bind mount, shielding the container's internal directories from host pollution.

```yaml
services:
  backstage:
    image: node:20-bookworm-slim
    working_dir: /app
    volumes:
      # 1. Host Bind Mount: Syncs your local code changes in real time.
      - .:/app

      # 2. Anonymous Volumes: Shields container-native dependencies from being overwritten.
      - /app/node_modules
      - /app/packages/backend/node_modules
      - /app/packages/app/node_modules
```

### Lifecycle & Mechanics

- **Container Boot:** During `docker compose up`, Docker creates an isolated cache for each unnamed path. It populates these volumes by copying the native Linux dependencies already baked into the image.
- **The Trapped State:** Code changes sync instantly across `. :/app`. However, if you run `yarn add` or `npm install` on your *host machine*, the container will not see it because the anonymous volume completely isolates that path.
- **Syncing New Packages:** Whenever you alter dependencies in your project files, you must force Docker to wipe and re-initialize its anonymous layers:

```bash
docker compose up -d --build --renew-anon-volumes
```

## Distributed Docker Compose Stacks via OCI Artifacts

Modern environments treat `docker-compose.yml` graphs as version-controlled **OCI Artifacts**. Instead of pulling raw files from Git or via `curl`, Docker Compose can publish, pull, and scale architectural topologies straight from **GitHub Container Registry (GHCR)**.

### Publishing to GHCR

You can package and push your `docker-compose.yml` file to GHCR using native Docker Compose features.

#### Package.json Configuration

Add a script to your project's `package.json` to handle registry authentication and artifact delivery:

```json
{
  "name": "workbench-tools",
  "version": "1.0.0",
  "scripts": {
    "infra:publish": "docker compose publish ghcr.io/your-org/workbench-compose:v1.0.0"
  }
}
```

Ensure your terminal is authenticated to GHCR via `docker login ghcr.io` before running `npm run infra:publish`.

### Running the Stack

You can launch an OCI-backed infrastructure stack directly from either the terminal or programmatically via a TypeScript task script.

#### Option A: Direct Command Line Interface (CLI)

To download and start the infrastructure bundle on demand, substitute the standard configuration flag with the `oci://` registry URI:

```bash
docker compose -f oci://ghcr.io/your-org/workbench-compose:v1.0.0 up -d
```

#### Option B: Programmatic TypeScript Control (`package.json` Task)

To integrate this logic clean into your application stack pipeline, implement a child-process execution pattern in TypeScript.

##### 1. Create your execution task script (`scripts/infra.ts`):

```typescript
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const args = process.argv.slice(2); // Captures trailing commands like 'up', 'down'
const OCI_IMAGE = 'oci://ghcr.io/your-org/workbench-compose:v1.0.0';
const OVERRIDE_FILE = 'workbench.override.yml';

// 1. Establish core arguments and target runtime path context
const composeArgs = ['compose', '--project-directory', process.cwd()];

// 2. Load the OCI base image graph definition
composeArgs.push('-f', OCI_IMAGE);

// 3. Chain local file layer modifications dynamically ahead of actions
if (existsSync(join(process.cwd(), OVERRIDE_FILE))) {
  composeArgs.push('-f', OVERRIDE_FILE);
}

// 4. Concat actions and final flags passed down from the engine thread
const finalArgs = [...composeArgs, ...args];

console.log(`Executing: docker ${finalArgs.join(' ')}`);

const child = spawn('docker', finalArgs, { stdio: 'inherit', shell: true });
child.on('exit', (code) => process.exit(code ?? 0));
```

##### 2. Bind the script toolchain within `package.json`:

```json
{
  "scripts": {
    "workbench": "ts-node scripts/infra.ts"
  }
}
```

##### 3. Execution Usage:

```bash
# Bring the remote stack up in background mode
npm run workbench up -d

# Target clean down configurations locally
npm run workbench down
```

### Local Layout Configuration Overrides

External developers do not modify the core workspace source files directly. They drop a localized `workbench.override.yml` into their working directory to adapt configurations on their machines. The system safely combines layers without creating file conflicts.

#### Scenario A: Changing a Bound Network Service Port

If a developer runs local PostgreSQL configurations on port `5432` natively, they can safely proxy the OCI workbench engine module outbound loop targeting alternate channels:

```yaml
# workbench.override.yml
services:
  postgres:
    ports:
      - "5433:5432" # Changes the host-facing port without breaking interior overlay spaces
```

#### Scenario B: Injecting Custom Ephemeral Core Modules

If an engineering workflow depends on a third-party image instance (such as MongoDB) outside the standard OCI baseline, they can declare it inside their local layer file:

```yaml
# workbench.override.yml
services:
  custom-mongo:
    image: mongo:latest
    ports:
      - "27017:27017"
    networks:
      - default # Joins the network bridge dynamically mapped by the base template
```

### GitHub Actions Workflow File

Create a file at `.github/workflows/publish-infra.yml` and paste the following content:

```yaml
name: Bump Version & Publish OCI Artifact

on:
  push:
    branches:
      - main
    paths:
      - 'docker-compose.yml'
      - 'package.json'
      - 'scripts/**'

# Grants permissions required to push commits and write to GitHub Packages (GHCR)
permissions:
  contents: write
  packages: write

jobs:
  bump-and-publish:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          # Fetches full history so git can commit back to the repository safely
          fetch-depth: 0 

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Configure Git Author
        run: |
          git config --global user.name "github-actions[bot]"
          git config --global user.email "github-actions[bot]@://github.com"

      - name: Bump Version (Semantic Patch)
        id: version_bump
        run: |
          # Bumps the patch version (e.g., 1.0.2 -> 1.0.3), updates package.json, and creates a git tag
          NEW_VERSION=$(npm version patch -m "chore(release): bump version to %s [skip ci]")
          echo "NEW_TAG=$NEW_VERSION" >> $GITHUB_ENV
          
          # Extracted stripped down pure semver string (drops the 'v' prefix)
          PURE_VERSION=$(node -p "require('./package.json').version")
          echo "PURE_VERSION=$PURE_VERSION" >> $GITHUB_ENV

      - name: Log in to GitHub Container Registry (GHCR)
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Publish OCI Compose Artifact to GHCR
        run: |
          # Dynamically overrides the script tag target inline using your existing config template
          docker compose publish ghcr.io/${{ github.repository_owner }}/workbench-compose:${{ env.PURE_VERSION }}

      - name: Push Version Changes back to Repository
        run: |
          # Pushes the package.json modification and the new version tag back up to your main branch
          git push origin main --follow-tags
```

## Docker Volume Persistence

By switching to named volumes, your developers can confidently manage their workflows without anxiety over losing data:

- **`my-dev-env down`**: This stops the containers and removes the isolated network bridge. However, the data volumes (`pgdata`, `temporaldata`, `redisdata`) remain safely intact inside Docker's storage engine. Running `my-dev-env up` again seamlessly reconnects the database to its exact previous state.
- **`my-dev-env down -v`**: If a developer intentionally messes up a migration, populates bad mock data, or simply wants a completely clean slate, passing the native `-v` (volumes) flag tells Docker to purge the database and reset the volume to zero.

### The Multi-Repo Scope Magic: `--project-directory`

Because your shell function uses the `--project-directory "$(pwd)"` flag, Docker Compose dynamically changes the **project namespace** based on the directory the developer is standing in.

- If they run the command inside `/projects/repo-A`, Docker names the volume `repo-a_pgdata`.
- If they move to `/projects/repo-B`, Docker names the volume `repo-b_pgdata`.

This guarantees that **Repo A and Repo B keep their vectors and databases completely separate**, even though both are pulling down the exact same `curl` string from your core repository.

### Handling Volume States in CI/CD

In your GitHub Actions pipeline, you do not want data persisting between separate workflow runs (which can lead to weird runner caching bugs or test contamination).

Because GitHub Actions spins up a completely fresh, isolated virtual machine (`runs-on: ubuntu-latest`) for every single commit, Docker starts with a blank slate every single time.

You can securely run your setup, perform your E2E migrations and tests, and cleanly teardown the stack with volume removal to ensure the virtual machine leaves no footprints behind:

```yaml
      # Inside your github actions pipeline
      - name: Stop Dev Stack & Purge Volumes
        if: always()
        run: |
          curl -s https://githubusercontent.com | \
          docker compose -f - --project-directory . down -v
```

Now that the core architecture, CI/CD pipes, Windows guardrails, and data layers are designed, let me know if you would like to:

- See how to automate **database migrations** inside the `pgvector` container right after it boots up
- Write the script to automatically install the `my-dev-env` function directly into a developer's **Zsh or Bash profile**

## Dockerfiles

### Dynamically Configuring a Dockerfile: ENV vs. ARG

You cannot use runtime environment variables (`ENV`) to dynamically change *how* a Dockerfile builds (e.g., you can't use an `ENV` to conditionally change a `RUN` statement or an image tag).

#### The Difference Between ARG and ENV

- **`ARG` (Build-Time Variables):** This is the **best and only way** to dynamically configure a Dockerfile's compilation behavior. They are stripped out once the image is built.
- **`ENV` (Runtime Environment Variables):** These have no power during the build phase itself; they dictate application state *after* the container boots.

#### The Best-Practice Blueprint

To dynamically configure a Backstage build (for example, swapping between a heavy local dev image and a lean CI image), use `ARG` paired with multi-stage targets:

```dockerfile
# 1. Dynamically configure the base OS image using an ARG
ARG NODE_VERSION=20-bookworm-slim
FROM node:${NODE_VERSION} AS base
WORKDIR /app

# 2. Use a build-time argument to determine if we install test tools
ARG INSTALL_TEST_TOOLS=false
RUN if [ "$INSTALL_TEST_TOOLS" = "true" ] ; then \
      apt-get update && apt-get install -y playwright; \
    fi

COPY package.json yarn.lock ./

# --- TARGET 1: Development Platform ---
FROM base AS dev
ENV NODE_ENV=development
CMD ["yarn", "start"]

# --- TARGET 2: Production/CI Platform ---
FROM base AS production
RUN yarn install --immutable
CMD ["node", "packages/backend"]
```

You drive this configuration natively from your `docker-compose.yml` file using the `args` and `target` keys:

```yaml
services:
  backstage:
    build:
      context: .
      target: dev  # Swaps stages dynamically
      args:
        NODE_VERSION: "20-bookworm"
        INSTALL_TEST_TOOLS: "true"
```

### How to Pull and Run Remote Dockerfiles

You do not need to keep `Dockerfiles` locally inside every repository either. You can declare a remote Git repository as the **Build Context** directly inside your `docker-compose.yml`.

If your `workbench` repo holds the core `Dockerfile` used to boot Backstage, your downstream repository can instruct Docker to download that Git repository and build the container out of it remotely:

```yaml
services:
  backstage-workbench:
    build:
      # 1. Provide the URL to the remote repository as the context
      context: https://github.com
      # 2. Tell it exactly where the Dockerfile is located inside that repo
      dockerfile: ./packages/backend/Dockerfile 
```

## Extending `app-config.yaml`

Backstage natively supports a powerful configuration loading hierarchy. You do not need to manually merge YAML files; the Backstage CLI merges multiple files sequentially at startup using a **left-to-right priority matrix**. When you pass multiple `--config`  flags, subsequent files overwrite scalar values and merge/extend arrays or object keys:

```bash
yarn start \
  --config ../workbench/app-config.yaml \
  --config ./app-config.workbench-overlay.yaml
```

Backstage also looks for file naming conventions automatically. If you run your application, it will load configuration files in this order of priority:

1. `app-config.yaml` (Base global setup)
2. `app-config.local.yaml` (Automatically loaded if it exists; usually git-ignored for developer overrides)
3. `app-config.production.yaml` (Loaded if `NODE_ENV=production`) 

## Backstage Dynamic Plugins (Side-loading)

With this architecture, you do not have to rebuild or recompile your application code when dynamically adding plugins, but **you still need a simple container restart** for the system to scan and register the new assets.

### How Backend Dynamic Plugins Work

Backstage provides the experimental `@backstage/backend-dynamic-feature-service`. It shifts plugin loading from hardcoded code definitions to a file-scanner mechanism:

1. **The Scanner:** During boot, Backstage scans a designated directory (`dynamicPlugins.rootDirectory`).
2. **The Injection:** It dynamically imports (`import()`) any standalone compiled packages it finds there and registers their routes, catalog extensions, or scaffolder actions into the backend dependency injection container.

**The Flow:** You place a compiled plugin tarball or OCI artifact into the plugins folder, update your `app-config.yaml` to declare it, and **restart the pod/container**. No code recompilation or `yarn install` is needed on the core server.

### How Frontend Dynamic Plugins Work

The frontend follows a very similar pattern via the `@backstage/frontend-dynamic-feature-loader`.

1. **The Architecture:** It relies heavily on **Webpack Module Federation**.
2. **The Flow:** The backend dynamic plugin service serves compiled frontend static chunks (JS, CSS, manifests) over HTTP. When the Backstage frontend loads in the user's browser, it requests the plugin manifest from the backend and lazily evaluates the remote Webpack modules.

**The Runtime Behavior:** While Module Federation inherently allows completely dynamic browser evaluation without a container restart, standard enterprise setups (like the Red Hat Developer Hub/Janus IDP distribution built on this upstream tech) still tie frontend plugin definitions to a main `dynamic-plugins.yaml` configuration matrix. Therefore, adding a frontend plugin safely usually triggers a rolling container restart to refresh the global configuration layer served to the browser.

## Backstage / Crew Suite Internal Systems Mocks

### Catalog Mocks

These are wired in using `packages/backend/app-config.yaml` .

```yaml
catalog:
  locations:
    - type: file
      target: ${MOCK_FIXTURES_PATH:-../../mock-fixtures}/location.yaml
```

### Kubernetes Mocks

See `NOTES_KUBERNETES_MOCKS.md`

### Scaffolder Mocks

See `NOTES_SCAFFOLDER_MOCKS.md`

### Techdocs Mocks

These are also wired in using `packages/backend/app-config.yaml` and must follow a specific directory structure.

```yaml
techdocs:
  builder: 'local'
  generator:
    runIn: 'local' # Safe: Prevents dangerous Docker-in-Docker container requirements in EKS
  publisher:
    type: 'local'
    local:
      publishDir: ${MOCK_FIXTURES_PATH:-../../mock-fixtures}/techdocs
```

## Wiremock Architecture for Network Mocks

The macro interception doesn't happen at the Node.js application process layer; it happens natively inside our cluster service mesh topology.

We run a standalone **WireMock container instance** that acts as our air-gapped simulation perimeter gateway. This container is wired directly into your local orchestration stack via your root infrastructure scripts.

### How network mocks work inside `docker-compose`:

When you invoke **`yarn infra:up`**, your system boots your database alongside a containerized proxy tap:

```yaml
services:
  wiremock:
    image: wiremock/wiremock:3.9.1-alpine
    ports:
      - "8080:8080" # Binds to port 8080 on your local workstation
    volumes:
      # 1. Mounts the routing rules maps (URL paths, path matches, query hooks)
      - ./../mock-network/mappings:/home/wiremock/mappings:ro
      # 2. Mounts your unified dataset package (vendor/ directory) straight into WireMock's asset file system
      - ./../mock-fixtures:/home/wiremock/__files:ro
```

When your custom drivers send out an external call, WireMock intercepts the request, maps it against your rules, reads the file (e.g., `vendor/pagerduty-platform-incidents.json`), and echoes the telemetry dataset back to your app instantly—with absolute zero real internet exposure.

### How network mocks work inside `app-config.yaml`

To feed this proxy network smoothly without hardcoding `localhost:8080` everywhere, your code layers rely on the variable operator mappings we consolidated inside your master **`packages/app-config/app-config.yaml`** file:

```yaml
drivers:
  pagerduty:
    # Redirects runtime HTTP client endpoints dynamically
    baseUrl: ${MOCK_PROXY_URL:-http://localhost:8080}
    apiToken: mock-token-compliance-override
  datadog:
    baseUrl: ${MOCK_PROXY_URL:-http://localhost:8080}
```

For day-to-day local development, you simply boot the modern server server natively (`yarn start`). The configuration falls back to **`http://localhost:8080`**. The backend server process pushes vendor integration queries straight out to your local running compose wiremock container on port 8080.

### Headless E2E Staging Pipeline for Wiremock Network Mocks

When **`run-ci-e2e-tests.yml`** deploys an isolated preview namespace to an AWS self-hosted EKS cluster runner, your Helm upgrades inject your custom DNS string:

```bash
--set backstage.config.mockProxyUrl="http://cluster.local"
```

The value is consumed in `deploy-kubernetes/helm/backstage/templates/deployment.yaml`.

The containerized application pod receives the variable mapping, binds its internal REST drivers to the inner Kubernetes service network route, and executes high-speed Playwright browser test sweeps against the configured data seeds.

### WireMock as a Server and its Management API

WireMock runs as a fully featured HTTP server and features a rich REST API. By default, when you launch the WireMock container, it exposes a administrative control endpoint at **`http://localhost:8080/__admin`**. You can completely manage WireMock dynamically via this API at runtime without restarting the container or manually touching JSON files.

#### Key Management Capabilities

- **Dynamic Stubbing:** You can POST new JSON stub mappings directly to the API.
- **Verification:** You can query WireMock to verify if an agent or plugin actually sent a specific request (critical for E2E validation assertions).
- **Recording:** You can put WireMock into "proxy mode," let it capture traffic to a real service (like Datadog), and it will automatically save those interactions as stubs.

#### Example: Dynamically Injecting a Mock via HTTP POST

A consuming repository can dynamically inject a brand new API response into the active Workbench environment on the fly using a standard `curl` or a test script:

```bash
curl -X POST http://localhost:8080/__admin/mappings \
  -H "Content-Type: application/json" \
  -d '{
    "request": {
      "method": "GET",
      "url": "/api/v1/agents/status"
    },
    "response": {
      "status": 200,
      "jsonBody": { "agent": "active", "workflow": "optimized" },
      "headers": { "Content-Type": "application/json" }
    }
  }'
```

This enables an integration workflow where an agent test suite can programmatically set up its own network state dependencies before running its validation passes, then tear them down afterward using `POST /__admin/mappings/reset`.

## Custom Backstage Modules (Processors)

This section is to track custom processors that we are adding to Backstage in the Workbench `backend` package.

## Wrapping Backstage in Docker

Here is what the architecture looks like when containerizing the Backstage runtime inside the workbench while allowing consumer repos to overlay mock footprints natively.

### The Global `workbench/Dockerfile`

Create a multi-stage production/development blueprint in your workbench repo root:

```dockerfile
FROM node:20-bookworm-slim AS base
WORKDIR /app

# Install isolated system configurations for node-gyp builds & python dependencies
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    build-essential python3 python3-pip g++ make

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn

FROM base AS dev
# Force standard local development configuration flags
ENV NODE_ENV=development
# Boot using backstage's native watch compiler
CMD ["yarn", "start"]
```

### The Base `workbench/docker-compose.yml`

This file maps out the core platform services alongside your containerized Backstage application node.

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg18
    container_name: crew-infra-db
    environment:
      POSTGRES_USER: backstage
      POSTGRES_PASSWORD: backstage
      POSTGRES_DB: backstage_plugin_catalog
    ports:
      - "5432:5432"

  redis:
    image: redis:8.10-alpine
    container_name: crew-infra-cache
    ports:
      - "6379:6379"

  wiremock:
    image: wiremock/wiremock:3.13.2-alpine
    container_name: crew-infra-mocks
    ports:
      - "8080:8080"
    volumes:
      - ./mock-network/mappings:/home/wiremock/mappings:ro
      - ./mock-fixtures:/home/wiremock/__files:ro
    command: --global-response-templating --async-response-enabled=true

  backstage:
    build:
      context: .
      target: dev
    container_name: crew-backstage-workbench
    ports:
      - "7007:7007" # Backend API
      - "3000:3000" # Frontend UI Portal
    environment:
      NODE_ENV: development
      MOCK_PROXY_URL: http://wiremock:8080  # Points to internal compose DNS name
    volumes:
      # 1. Overlay the local application code to enable instant hot-reloading
      - .:/app
      # 2. Hiding Trick: Prevents host computer files from stepping over container-built assets
      - /app/node_modules
      - /app/packages/backend/node_modules
      - /app/packages/app/node_modules
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
```

### The Downstream Consumer Repository Overlay

When a developer checks out a downstream workspace—for example, the `drivers` repo—they do not need to modify the workbench directly. They maintain a file named `docker-compose.workbench.yml` inside their own project root:

```yaml
# drivers-repo/docker-compose.workbench.yml
services:
  # Inject specific drivers mock plane directly onto the active WireMock node
  wiremock:
    volumes:
      - ./test/wiremock-mappings:/home/wiremock/mappings/drivers:ro
      - ./test/wiremock-fixtures:/home/wiremock/__files/drivers:ro

  # Inject custom test catalog schemas onto the Backstage orchestration boundary
  backstage:
    environment:
      CONSUMER_CATALOG_TYPE: file
      CONSUMER_CATALOG_TARGET: /app/external-mounts/drivers-catalog.yaml
    volumes:
      - ./catalog-info.yaml:/app/external-mounts/drivers-catalog.yaml:ro
```

## Build Tooling for Dockerfiles

To handle both local developer builds and automated CI releases from a single source of truth, you can use a unified build strategy powered by **Docker Buildx** (Docker's modern build engine). Buildx natively supports multi-architecture builds (e.g., supporting both Apple Silicon Macs and Intel/AMD Linux runners), caching, and seamless registry pushes.

Since you already use **Terraform and Helm for AWS CD**, pushing to a public registry like **GitHub Container Registry (GHCR)** or **Docker Hub** is ideal. External developers can pull from it freely, and your Helm charts can reference the public tags directly.

Here is the exact blueprint for your Dockerfile, your local build tool, and your GitHub Actions workflow.

### The Multi-Stage TypeScript Dockerfile

To minimize image size and protect source code, use a multi-stage `Dockerfile`. This ensures that TypeScript compilation dependencies (`devDependencies`) never make it into the final image used by external developers or your production cluster.

```dockerfile
# --- Stage 1: Build & Compile TypeScript ---
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package management files
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Prune node_modules to only include production dependencies
RUN npm prune --production

# --- Stage 2: Final Lightweight Runtime ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy compiled JavaScript and optimized production dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Local Developer Build & Push Tooling

To ensure developers don't have to remember complex Docker commands, wrap the build engine in a simple `npm run` script inside your `package.json`.

```json
"scripts": {
  "build": "tsc",
  "docker:login": "docker login",
  "docker:build": "docker buildx build --platform linux/amd64,linux/arm64 -t ghcr.io/your-org/my-dev-server:local --load .",
  "docker:push": "docker buildx build --platform linux/amd64,linux/arm64 -t ghcr.io/your-org/my-dev-server:latest --push ."
}
```

- **`--platform linux/amd64,linux/arm64`**: This is critical for open-source workbenches. It creates a single "manifest" image that runs natively on M1/M2/M3 Macs *and* standard Intel/AMD linux servers (or AWS EC2/EKS nodes via your Helm charts).
- **`--load`**: Builds the image and saves it to the developer's local Docker daemon so they can test it instantly.
- **`--push`**: Compiles and pushes directly to the registry in a single step.

### CI/CD: The GitHub Actions Workflow

Add a new workflow file (e.g., `.github/workflows/docker-publish.yml`). It triggers on merges to the main branch or whenever a release tag (like `v1.2.3`) is created. It automatically hooks into your public GitHub Packages repository (`ghcr.io`).

```yaml
name: Publish Docker Image

on:
  push:
    branches: [ "main" ]
    tags: [ 'v*.*.*' ]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }} # e.g., your-org/my-dev-server

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write # Required to push to GHCR

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      # Set up QEMU for multi-architecture building (ARM64 + AMD64)
      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3

      # Set up Docker Buildx
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      # Log into the GitHub Container Registry
      - name: Log into registry ${{ env.REGISTRY }}
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }} # Automatically provided by GitHub

      # Extract metadata (tags, labels) for Docker
      - name: Extract Docker metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=semver,pattern={{version}}
            type=ref,event=branch
            type=sha,format=short

      # Build and push the multi-arch image with advanced layer caching
      - name: Build and push Docker image
        uses: docker/buildx-action@v3
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ id.meta.outputs.tags }}
          labels: ${{ id.meta.outputs.labels }}
          cache-from: type=gha # Uses GitHub Actions native cache for blazing fast builds
          cache-to: type=gha,mode=max
```

### Integrating with your CD (Helm & Terraform)

Because this setup pushes standard image tags (`:main`, `:v1.2.3`, `:latest`) to a completely public registry (`ghcr.io`), connecting it to your existing CD stack is incredibly straightforward:

#### Helm Chart Integration

In your `values.yaml`, you can now cleanly reference your automated public image:

```yaml
image:
  repository: ghcr.io/your-org/my-dev-server
  tag: "latest" # Overridden by CI during CD deployment
  pullPolicy: Always
```

### Terraform Synchronization

If your Terraform files provision the infrastructure (like EKS, ECS, VPCs) and pass variables down to your Helm provider, you can simply inject the generated image tag dynamically as an input variable into your Terraform workspace runner.

To seamlessly tie your freshly built Docker image directly into your CD pipeline using the short Git commit SHA, you can combine your build jobs and deployment jobs into a single unified GitHub Actions workflow.

Here is exactly how to wire up that automated handoff, followed by the solution for your developers running Windows host machines.

### Automated CD Handoff via short SHA

The cleanest way to handle this is to capture the short commit SHA outputted by the `docker/metadata-action` step and pass it downstream to your Terraform and Helm steps via a GitHub Actions **job output**.

Here is how you update your workflow to achieve automated deployment on every build:

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ "main" ]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    # Define outputs so subsequent jobs can read the short SHA tag
    outputs:
      short_sha: ${{ steps.vars.outputs.short_sha }}
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Extract Short SHA
        id: vars
        run: echo "short_sha=$(git rev-parse --short HEAD)" >> $GITHUB_OUTPUT

      # ... (Set up QEMU, Buildx, and Login actions as detailed previously) ...

      - name: Extract Docker metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=raw,value=${{ steps.vars.outputs.short_sha }}
            type=raw,value=latest

      - name: Build and push Docker image
        uses: docker/buildx-action@v3
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    runs-on: ubuntu-latest
    needs: build-and-push # Ensures deployment only happens after a successful build
    steps:
      - name: Checkout Infra Repository
        uses: actions/checkout@v4

      # Configure your AWS credentials here
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      # OPTION A: If your Terraform executes Helm directly
      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3

      - name: Terraform Apply
        run: |
          terraform init
          terraform apply -auto-approve -var="app_image_tag=${{ needs.build-and-push.outputs.short_sha }}"

      # OPTION B: If you run Helm CLI natively
      - name: Set up Helm
        uses: azure/setup-helm@v4

      - name: Helm Upgrade / Deploy
        run: |
          aws eks update-kubeconfig --name my-cluster-name
          helm upgrade --install my-release ./charts/my-app \
            --set image.tag=${{ needs.build-and-push.outputs.short_sha }}
```

In your Terraform codebase, your Helm resource block would look like this to capture the variable dynamically:

```hcl
variable "app_image_tag" {
  type = string
}

resource "helm_release" "app" {
  name       = "my-release"
  chart      = "./charts/my-app"
  
  set {
    name  = "image.tag"
    value = var.app_image_tag
  }
}
```

### Mandate WSL 2 with Ubuntu

To **mandate WSL 2 with Ubuntu**, you cannot programmatically lock a user's operating system, but you can configure your repository's environment check to fail immediately with a clear error message if a Windows developer attempts to run your workbench tools outside of a proper Linux environment.

Here is how you can implement this barrier via **documentation, environment gating, and terminal assertions**.

#### 1. The Environment Gate (Fail Early in Tooling)

If you use a lightweight bootstrap script (like a shell script or an `npm` script) to run the `my-dev-env` command, you should inject an operating system check right at the beginning.

If you are using the **Native Shell Function** approach distributed via a setup script, add this check to block execution on native Windows shells (CMD and PowerShell):

```bash
# Inside your setup or run script
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
  echo "❌ ERROR: Native Windows environments are not supported."
  echo "--------------------------------------------------------"
  echo "To use this workbench on Windows, you MUST use WSL 2 with Ubuntu."
  echo "Please open an Ubuntu terminal window and run this command there."
  echo "See docs: https://github.com"
  exit 1
fi

# If they are on Windows but running inside WSL, this passes perfectly because $OSTYPE is 'linux-gnu'
```

If they are running an installation script via Node/NPM, you can assert that they are inside a Linux environment and explicitly check the `/proc/version` file, which contains the string `"Microsoft"` or `"WSL"` when running inside WSL 2:

```javascript
import fs from 'fs';
import os from 'os';

if (os.platform() === 'win32') {
  console.error("❌ ERROR: Native Windows (PowerShell/CMD) is not supported.");
  process.exit(1);
}

// Ensure that if it is Linux, it is specifically WSL 2 if you want to be strict
try {
  const version = fs.readFileSync('/proc/version', 'utf8');
  if (!version.toLowerCase().includes('microsoft') && !version.toLowerCase().includes('wsl')) {
    // They are on a native Linux machine (which is totally fine!)
  }
} catch (e) {
  // Not a WSL/Linux system
}
```

#### The Devcontainer Path (The Bulletproof Approach)

The absolute best way to "mandate" WSL 2 seamlessly for Windows developers (while also helping Mac users) is to provide a `.devcontainer/devcontainer.json` file in your repository.

When a Windows developer clones your repository using **VS Code**, VS Code will detect this file and display a prompt: *"Reopen in Container"* or *"Reopen in WSL"*.

```json
{
  "name": "Workbench Dev Environment",
  "image": "://microsoft.com",
  "features": {
    "ghcr.io/devcontainers/features/docker-outside-of-docker:1": {} // Connects local Docker
  },
  "customizations": {
    "vscode": {
      "extensions": [
        "ms-azuretools.vscode-docker"
      ]
    }
  }
}
```

**Why this works:** To use Devcontainers on Windows, VS Code natively forces the user to install WSL 2 and Ubuntu behind the scenes. It automates your environment mandate for you through IDE tooling.

#### Documentation Blueprint for Windows Users

To make the onboarding friction as low as possible, your repository's `README.md` should have a dedicated, copy-pasteable installation block specifically for Windows users.

```markdown
## 💻 Windows Prerequisites (WSL 2 Mandatory)

Native Windows (PowerShell, Command Prompt, or Git Bash) is **not supported** due to shell script compatibility and multi-container Docker volume performance. 

To set up your environment:

1. Open PowerShell as Administrator and install WSL 2 with Ubuntu:
   ```powershell
   wsl --install -d Ubuntu
```
2. Restart your computer when prompted.
3. Open the **Ubuntu** application from your Windows Start Menu and complete the Unix username/password setup.
4. Download and install [Docker Desktop for Windows](https://docker.com).
5. Open Docker Desktop settings, navigate to **General**, and ensure **Use the WSL 2 based engine** is checked.
6. Navigate to **Resources > WSL Integration**, and toggle on **Ubuntu**.

From this point forward, **always** clone this repository and run all commands inside your Ubuntu terminal window.
```

### Block Execution on Native Windows

Here is how to set up both the **automated package.json lifecycle gate** to physically block execution on native Windows, and the **VS Code Devcontainer setup** to guide Windows users into a functional WSL 2 environment automatically.

#### The `package.json` Environment Gate

You can use a custom Node script hooked into the `prestart` or `predev` lifecycles of your `package.json`. If a user attempts to boot the workbench from native PowerShell, CMD, or Git Bash, the script will kill the process immediately and print instructions.

#### 1. Create the Gate Script (`scripts/check-env.js`)

```javascript
import fs from 'fs';
import os from 'os';

function assertWSL() {
  const isWin = os.platform() === 'win32';

  // 1. Immediately catch native Windows shells (CMD, PowerShell)
  if (isWin) {
    printErrorAndExit();
  }

  // 2. Check Git Bash / MSYS / Cygwin (which report as 'linux' or 'darwin' style environments but are on Windows host)
  if (process.env.OSTYPE && (process.env.OSTYPE.includes('msys') || process.env.OSTYPE.includes('cygwin'))) {
    printErrorAndExit();
  }

  // 3. Verify if they are actually running on Linux, it's either native Linux or WSL 2
  if (os.platform() === 'linux') {
    try {
      const version = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
      const isWSL = version.includes('microsoft') || version.includes('wsl');
      
      // If it's not WSL and not native Linux (unexpected container layer), you could flag it, 
      // but generally if it's linux/wsl it passes.
      return; 
    } catch (e) {
      // Missing /proc/version completely implies a non-standard environment
      printErrorAndExit();
    }
  }
}

function printErrorAndExit() {
  console.error('\x1b[31m%s\x1b[0m', '====================================================================');
  console.error('\x1b[31m%s\x1b[0m', '❌ ENVIRONMENT ERROR: Native Windows environments are not supported!');
  console.error('\x1b[31m%s\x1b[0m', '====================================================================');
  console.error('This Workbench requires a native Unix shell for Docker orchestration.');
  console.error('\nTo run this project on Windows, you MUST use WSL 2 (Windows Subsystem for Linux) with Ubuntu.');
  console.error('\n👉 Setup Instructions:');
  console.error('1. Install WSL 2: Run `wsl --install -d Ubuntu` in PowerShell.');
  console.error('2. Enable WSL Integration inside Docker Desktop Settings.');
  console.error('3. Clone this repo and run commands strictly INSIDE your Ubuntu terminal.');
  console.error('\nSee full guide: https://github.com\n');
  process.exit(1);
}

assertWSL();
```

#### 2. Wire it into `package.json`

Hook this script into whichever commands the developers run locally. By prefixing your command with `pre`, npm/yarn/pnpm will automatically force it to run first:

```json
"scripts": {
  "predev": "node scripts/check-env.js",
  "dev": "my-dev-env up"
}
```

### The VS Code Devcontainer Setup

To remove manual friction entirely, you can supply a `.devcontainer` configuration. When a Windows developer opens the repo in VS Code, the IDE detects this directory and safely provisions an isolated Linux workspace that mounts directly into their Windows Docker engine.

#### 1. Create a `.devcontainer` directory

Inside your project root, create a directory named `.devcontainer`. Inside it, create two files: `devcontainer.json` and a `Dockerfile`.

#### 2. `.devcontainer/Dockerfile`

This ensures the environment running inside the Devcontainer has Docker installed so it can talk to the host machine's Docker engine (Docker-outside-of-Docker).

```dockerfile
FROM ://microsoft.com

# Install standard tools needed for the workbench curl functionality
RUN apt-get update && apt-get install -y \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*
```

#### 3. `.devcontainer/devcontainer.json`

This instructs VS Code how to boot the environment, share the host's Docker socket daemon securely, and auto-install useful extensions.

```json
{
  "name": "Workbench Dev Environment",
  "build": {
    "dockerfile": "Dockerfile"
  },
  "features": {
    // Crucial: This links the devcontainer to the developer's desktop Docker engine
    "ghcr.io/devcontainers/features/docker-outside-of-docker:1": {
      "version": "latest",
      "enableNonRootDocker": "true"
    }
  },
  // Automatically configure settings and install extensions inside the container
  "customizations": {
    "vscode": {
      "extensions": [
        "ms-azuretools.vscode-docker",
        "dbaeumer.vscode-eslint"
      ],
      "settings": {
        "terminal.integrated.defaultProfile.linux": "bash"
      }
    }
  },
  // Ensure files are mounted with proper performance flags
  "mounts": [
    "source=${localWorkspaceFolder},target=/workspace,type=bind,consistency=cached"
  ],
  "workspaceFolder": "/workspace",
  "remoteUser": "node"
}
```

### The Windows Developer Flow (End Result)

1. **The Guardrail:** If they blindly pull the repo into Windows PowerShell and type `npm run dev`, the script blocks them immediately, keeping them from running into obscure, broken Docker volume or syntax errors.
2. **The Golden Path:** If they open the repo in VS Code, a notification pops up: *"Folder contains a Dev Container configuration. Reopen in Container"*. Clicking it instantly drops them into a customized Linux shell where `my-dev-env up` runs perfectly out of the box, completely bypassing Windows host filesystem limits.

To prevent developers from losing their **pgvector** data, Temporal schemas, or Redis keys when running commands like `my-dev-env down`, you need to configure **named volumes** in your centralized master `docker-compose.yml` file.

The trick here is balancing **local persistence** (so data survives on a developer's laptop) with **isolated project scoping** (so that if a developer switches from `repo-a` to `repo-b`, their database states don't collide and corrupt each other).

Here is the exact setup to implement this robustly across both local environments and your CI/CD runners.

### Update the Centralized `docker-compose.yml`

In your master `docker-compose.yml` (the one hosted on GitHub and streamed via `curl`), you must declare **named volumes** at the bottom of the file and map them into your infrastructure services.

```yaml
version: '3.8'

services:
  express-app:
    image: ghcr.io/your-org/my-dev-server:latest
    ports:
      - "3000:3000"
    volumes:
      - ./local.config.json:/app/local.config.json
    depends_on:
      - postgres

  postgres:
    image: ankane/pgvector:latest
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: workbench_user
      POSTGRES_PASSWORD: workbench_password
      POSTGRES_DB: workbench_db
    volumes:
      # Map the named volume to Postgres's internal data directory
      - pgdata:/var/lib/postgresql/data

  temporal:
    image: temporalio/auto-setup:1.24.0
    ports:
      - "7233:7233"
    volumes:
      - temporaldata:/var/lib/temporal

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

# Declare the named volumes here
volumes:
  pgdata:
  temporaldata:
  redisdata:
```

## Milvus Vector Database Container for Testing

We added Milvus as a vector store engine in the Platform repo. We should probably have containers with all vector store engines to test: Milvus, Pgvector, and Qdrant.

To run **Milvus** locally inside your Docker Compose matrix alongside components like Temporal, you cannot just spin up a single isolated container. Milvus operates as a distributed system and relies on **three core dependencies**:

1. **etcd:** For cluster metadata coordination and service discovery.
2. **MinIO (or AWS S3 Mock):** For object storage of data snapshots, logs, and pre-compiled index structures.
3. **Milvus Standalone:** The actual engine coordinator execution loop.

### The `docker-compose.yml` Configuration Block

Append these three unified services to your master **`packages/containers/docker-compose.yml`** file to seamlessly patch Milvus into your development cluster:

```yaml
version: '3.8'

services:
  # 1. Metadata Storage Coordinator
  milvus-etcd:
    image: quay.io/coreos/etcd:v3.5.16
    environment:
      - ETCD_AUTO_COMPACTION_RETENTION=1
    volumes:
      - milvus-etcd-data:/etcd
    command: etcd -advertise-client-urls=http://127.0.0.1:2379 -listen-client-urls=http://0.0.0 --data-dir /etcd
    healthcheck:
      test: ["CMD", "etcdctl", "endpoint", "health"]
      interval: 5s
      timeout: 3s
      retries: 3

  # 2. Object File Storage Engine
  milvus-minio:
    image: minio/minio:RELEASE.2024-10-02T17-50-41Z
    environment:
      MINIO_ACCESS_KEY: minioadmin
      MINIO_SECRET_KEY: minioadmin
    volumes:
      - milvus-minio-data:/data
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 5s
      timeout: 3s
      retries: 3

  # 3. Main Milvus Engine Vector Coordinator
  milvus-standalone:
    image: milvusdb/milvus:v2.5.0
    command: ["milvus", "run", "standalone"]
    environment:
      ETCD_ENDPOINTS: milvus-etcd:2379
      MINIO_ADDRESS: milvus-minio:9000
    volumes:
      - milvus-standalone-data:/var/lib/milvus
    ports:
      - "19530:19530" # Core gRPC API port used by @zilliz/milvus2-sdk-node
      - "9091:9091"   # Management REST metrics endpoint
    depends_on:
      milvus-etcd:
        condition: service_healthy
      milvus-minio:
        condition: service_healthy

volumes:
  milvus-etcd-data:
  milvus-minio-data:
  milvus-standalone-data:
```

### Pairing it with your Backstage Configuration

Once your cluster is built using `yarn infra:up`, developers change their localized app configuration settings file to route all active pipeline workloads cleanly into Milvus via the gRPC endpoint:

```yaml
# app-config.local.yaml
vectorStore:
  type: 'milvus'
  milvus:
    address: 'localhost:19530' # Maps onto the forwarded Docker Compose bridg
```

## Hooking the Mock In-Memory Engine into Vitest

Configure your factory matching logic to fall back to `in-memory` when running inside test contexts:

```typescript
// plugins/vector-store-node/src/storage/factory.ts
case 'in-memory':
  return new InMemoryEngine();
```

Inside your **`vitest.config.ts`** or specific test workflows, mock your Backstage `app-config` context to cleanly route your factory to the mock engine:

```typescript
// plugins/agentic-workflow-backend/src/plugin.test.ts
import { describe, it, expect } from 'vitest';
import { ConfigFactory } from '@backstage/config';
import { createVectorEngine } from '@internal/plugin-vector-store-node';

describe('Vector Store Factory Isolation Loop', () => {
  it('instantiates the localized mock loop cleanly without pulling real network sockets', async () => {
    const config = ConfigFactory.fromPlain({
      vectorStore: { type: 'in-memory' }
    });

    const engine = await createVectorEngine(config, {} as any);
    await engine.initialize();
    
    await engine.addMemory('agent-x', 'EKS target setup', new Array(1536).fill(0.5));
    const results = await engine.searchSimilar(new Array(1536).fill(0.5), 1);
    
    expect(results[0].agentId).toBe('agent-x');
    expect(results[0].score).toBeGreaterThan(0.99); // Perfectly identical vectors
  });
});
```
