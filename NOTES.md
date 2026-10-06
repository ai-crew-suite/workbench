# 🌐 Workbench Planning

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

## Backstage / Crew Suite Internal Systems Mocks

### Catalog Mocks

These are wired in using `packages/backend/app-config.yaml` .

```yaml
catalog:
  locations:
    - type: file
      target: ${MOCK_FIXTURES_PATH:-../../mock-fixtures}/location.yaml
```

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

### Database Mocks

The **`packages/mock-database/database-init/pgvector-setup.sql`** initialization script is executed automatically by the target **Postgres Docker Container Engine** the absolute first time your cluster database boots up. It leverages a standardized configuration convention built natively into the official PostgreSQL Docker image.

## Wiremock

### Wiremock Architecture for Network Mocks

The macro interception doesn't happen at the Node.js application process layer; it happens natively inside our cluster service mesh topology.

We run a standalone **WireMock container instance** that acts as our air-gapped simulation perimeter gateway. This container is wired directly into your local orchestration stack via your root infrastructure scripts.

#### How network mocks work inside `docker-compose`:

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

#### How network mocks work inside `app-config.yaml`

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

#### Headless E2E Staging Pipeline for Wiremock Network Mocks

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

## Docker Compose

### The Docker Compose Volume Mount Chain

If you open the **`packages/containers/docker-compose.yml`** file, you will find a localized relational database service configured to map this file directly into a special internal directory:

```yaml
services:
  postgres-db:
    image: pgvector/pgvector:0.7.0-pg17 # Standard hardened Postgres + Vector math image
    ports:
      - "5433:5432" # Shifts the host port to 5433 to bypass workstation local conflicts
    environment:
      POSTGRES_USER: backstage
      POSTGRES_PASSWORD: backstage
    volumes:
      # Maps your script directly into the native initialization folder
      - ./../mock-database/database-init:/docker-entrypoint-initdb.d:ro
```

### The Automatic Boot Execution Lifecycle Loop

1. When you execute **`yarn infra:up`**, the Docker daemon spins up the container shell.
2. The internal entrypoint script of the PostgreSQL image checks if the database is running for the very first time. If it is empty, it initializes the core database files.
3. Immediately after initialization, **Postgres automatically loops through and executes every single `.sql` script it finds inside the `/docker-entrypoint-initdb.d/` folder in alphabetical order**.
4. It reads your `pgvector-setup.sql` file, registers the `CREATE EXTENSION IF NOT EXISTS vector;` syntax math structures, and builds your three distinct isolated plugin schemas (`catalog`, `scaffolder`, `auth`) perfectly before your server ever attempts its first connection tick.

### The Anonymous Volume Factory Trick

The **anonymous volume trick** solves a classic Docker problem: when you use a bind mount like `- .:/app`, Docker overlays your local laptop's directory directly over the container's `/app` folder. If your laptop has a `node_modules` folder (built for macOS/Windows), it overwrites the container's internal `node_modules` (built for Linux), breaking native binary dependencies.

By declaring an **unnamed (anonymous) volume** on a deeper subpath *after* mounting the code, you force Docker to protect that specific subfolder.

```yaml
services:
  backstage:
    image: node:20-bookworm-slim
    volumes:
      # 1. Host Bind Mount: Maps your local code into the container.
      #    This overlays your host's node_modules onto the container.
      - .:/app

      # 2. The Anonymous Volume Trick:
      #    Docker creates an isolated, anonymous directory in its engine layer.
      #    Because /app/node_modules is deeper than /app, Docker mounts this volume 
      #    ON TOP of the bind mount, hiding your laptop's node_modules.
      - /app/node_modules
      - /app/packages/backend/node_modules
      - /app/packages/app/node_modules
```

How it behaves during lifecycle events:

- **Initial `docker compose up --build`:** Docker runs `yarn install` during the image build phase. It saves those compiled Linux dependencies inside the image's `/app/node_modules`. When the container boots, the anonymous volume is initialized by copying those compiled files into itself.

- **Running `yarn add` inside the container:** The new package is written directly to the anonymous volume. It persists as long as the container runs.

- **The Catch (Limitation):** If you run `yarn add` on your host machine, the container won't see it because the anonymous volume isolates it. To sync new dependencies, you must pass the `--renew-anon-volumes` flag when restarting:

```bash
docker compose up -d --build --renew-anon-volumes
```

### How to Pull and Run a Remote `docker-compose.yml`

Docker Compose allows pulling configurations directly from Git via HTTP/HTTPS, SSH, and specific branches or paths.

#### Option A: Running a Remote Compose File Directly from the CLI

You can feed a remote Git URL directly into the `-f` flag of the CLI. Docker Compose will automatically clone the repository under the hood into a temporary cache and execute it: [[1](https://docs.docker.com/reference/cli/docker/compose/)]

```bash
# Run the main compose file from the main branch
docker compose -f https://github.com up

# Target a specific branch, tag, or commit hash using '@'
docker compose -f https://github.com@v1.2.0 up

# Target a file sitting inside a sub-directory using '#' and ':'
docker compose -f https://github.com#main:docker/docker-compose.yml up
```

#### Option B: The `include` Block (Best for your Multi-Repo System)

If you want your downstream `drivers` or `agents` repo to automatically extend your centralized workbench without devs typing massive URLs in the CLI, use Docker Compose's native **`include`** directive.

Inside a consumer repository's `docker-compose.yml`, pull the base setup from your remote Git repo:

```yaml
# drivers-repo/docker-compose.yml
include:
  - path: https://github.com
    project_directory: . # Forces relative paths to map to the consumer repo

services:
  # Your local driver services go here and natively extend the included workbench matrix!
  driver-test-suite:
    image: node:20-slim
    depends_on:
      - backstage # This entity name is natively inherited from the remote file!
```

### Docker Compose File Registry

While traditional Docker registries host container *images*, modern infrastructure treats `docker-compose.yml` graphs as **OCI Artifacts**.

You can bundle your Docker Compose files, version them, and push them straight to **Docker Hub** or **GitHub Packages (GHCR)** just like a standard image. Docker Compose can pull them down on demand via the same `include` syntax:

```yaml
include:
  - oci://ghcr.io/your-org/workbench-compose:v1.0.0
```

You publish these via tools like the Docker CLI or specialized package managers like Helm if mapping out Kubernetes equivalents later.

## Dockerfiles

### Docker Overlays Using Standard Docker Volumes

Using volumes as an "overlay" means you mount host directories directly into a container run-space to inject configurations or code on the fly without forcing a rebuild of the Docker image.

When wrapping your entire Backstage server inside Docker for local development, you need an overlay strategy that satisfies two competing requirements:

1. **Isolation:** The core workspace node dependencies (`node_modules`) should reside inside the container architecture so developers don't run into cross-platform binary incompatibilities (e.g., a developer on macOS M3 compiling native extensions that fail to execute inside a Linux Docker container).
2. **Hot Reloading:** Developers still need to change code on their local laptop hosts and see Backstage instantly refresh via its live-reload compiler.

You achieve this using a combination of **bind mounts** for the code and an **anonymous volume factory trick** to protect the internal dependencies.

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

### Current Dockerfiles in Repo

An analysis of your two configuration setups reveals they represent entirely different strategies for building and deploying Backstage.

The first file (`backstage-node22.Dockerfile`) is a custom-architected **Multi-Stage Build** designed for clean automation in CI pipelines. The second file (`packages/backend/Dockerfile`) is Backstage's official **Host Build Blueprint**, which expects you to compile code on your laptop or a CI runner runner *before* invoking Docker.

#### Direct Comparison Overview

| Feature | `packages/containers/backstage-node22.Dockerfile` | `packages/backend/Dockerfile` |
| --- | --- | --- |
| **Primary Intent** | **Hermetic, CI-driven standalone deployment** | **Ultra-fast local build packaging** |
| **Compilation Location** | Entirely **inside** the Docker container boundaries   | Entirely **outside** on your local host machine |
| **Caching Mechanism** | Explicitly mapping specific `package.json` boundaries | Reads zipped pre-built Backstage skeleton files |
| **Base OS Layer** | Debian (`node:24-bookworm-slim`)                      | Debian (`node:24-trixie-slim`) |
| **Signal Handling** | Natively handles process lifecycle events via `tini`  | Relying on direct standard `node` sub-process |

#### Deep Dive Analysis

##### `packages/containers/backstage-node22.Dockerfile`

- **Intended Purpose:** Hermetic CI compilation and high-security hosting.
- **How it works:** This is a 3-stage pipeline. It pulls the base image, copies *only* the specific `package.json` files to stabilize the Yarn installation cache layer, runs `yarn compile` using `turbo.json`, and outputs a highly optimized final container containing only the compiled deployment assets.
- **Pros:** Highly predictable. Because the source code compilation happens inside the container, developers on any operating system (macOS, Windows, Linux) will generate the exact same artifact. It also ships with `tini` as an init system wrapper, which handles OS zombie processes and clean shutdowns.
- **Cons:** Slower build cycles. Any change to a core dependency or workspace structure busts the early caching layers, triggering full re-installations inside the Docker engine loop.

##### `packages/backend/Dockerfile`

- **Intended Purpose:** Rapid local containerization and staging checks.
- **How it works:** This is the default blueprint shipped by the Spotify core team. It treats Docker purely as a "packing wrapper". It **will fail immediately** if you haven’t already executed `yarn install`, `yarn tsc`, and `yarn build:backend` natively on your laptop first. It looks for pre-packaged `.tar.gz` skeleton distributions generated by the host machine.
- **Pros:** Unmatched execution speed. Since your local machine handles the TypeScript compilation steps, Docker only needs to unpack tarballs and start the server.
- **Cons:** Architecture mismatch vulnerabilities. If you run a local build on a macOS laptop, native C++ extensions (like `sqlite3` or `isolated-vm`) are compiled for macOS ARM architecture. When Docker tries to read them inside its Linux environment, the server will crash at runtime with binary errors.

## Custom Backstage Modules (Processors)

This section is to track custom processors that we are adding to Backstage in the Workbench `backend` package.

# Comprehensive Setup: Wrapping Backstage in Docker

Here is what the architecture looks like when containerizing the Backstage runtime inside the workbench while allowing consumer repos to overlay mock footprints natively.

## The Global `workbench/Dockerfile`

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

## The Base `workbench/docker-compose.yml`

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

## The Downstream Consumer Repository Overlay

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

## Running the Complete System in CI / Local Dev

To tie this execution layout together seamlessly, developers or CI pipelines within the downstream repos run a unified call pointing across boundaries:

```bash
docker compose \
  -f ../workbench/docker-compose.yml \
  -f ./docker-compose.workbench.yml \
  up --build
```

This single string executes the entire matrix: it initializes PostgreSQL/Redis, sets up the base Backstage server engine, mounts the downstream repository's unique domain code and catalogs right inside the active engine instance, and isolates your dependencies perfectly.
