# Notes on Adding Dependencies with Containers

## Overview of Problem

- The container OS and the host OS might be different (Debian vs Windows/macOS), causing native packages (like `better-sqlite3`) to compile different binary ABIs. Bind mounting the host root folder will overwrite container binaries and cause crashes.

- The solution is to use a root anonymous volume. When the container starts (`docker compose up`), Docker populates this volume with the container-native dependencies built during the image creation phase, shielding it from the host bind-mount.

## Monorepo Considerations (Yarn v4 Hoisted)

- Because Yarn v4 hoists dependencies to the root, individual packages inside `packages/*` do not possess standard `node_modules` folders. 

- **Correction:** Do not add anonymous volumes for individual sub-packages. Only shield the root level.

```yaml
services:
  backstage:
    image: node:20-bookworm-slim
    working_dir: /app
    volumes:
      - .:/app
      # Shield ONLY the root. Individual package node_modules volumes are omitted
      # to match Yarn v4's hoisted architecture.
      - /app/node_modules
```

## How to Add Packages Safely

- **Do not** use `docker compose exec` to install dependencies dynamically. This leaves your host machine's IDE out of sync and risks fracturing your `yarn.lock` file.

- **Proper flow:** Run `yarn workspace <pkg> add <dep>` on the host machine to update lockfiles and configurations, then trigger a container recreation (`docker compose up --build`) to allow the container to rebuild its native environment.

## How the Host Path `.` is Determined

**Yes, it is determined by the directory from which you execute the `docker compose` command**, but with a slight caveat depending on how you reference your file. Specifically:

- By default, Docker Compose resolves relative paths (like `.`) relative to the **directory of the `docker-compose.yml` file itself**, regardless of where your terminal is sitting.
- However, if you use the `-f` flag to point to a file in a different directory (e.g., `docker compose -f ../docker-compose.yml up`), `.` will still resolve relative to that targeted configuration file, not your active terminal path.

## Host Path Resolution with OCI Artifacts (`oci://`)

When you run `docker compose -f oci://... up -d`, the behavior changes because there is no local file on disk to act as a baseline. **The `.` host path resolves to the directory from which you execute the `docker compose` command.**

Here is exactly what happens behind the scenes:

1. **Downloading to a Cache:** Docker Compose pulls the OCI artifact (which contains your `compose.yaml`) down from the remote registry. It unpacks the configuration file into a volatile, temporary cache directory managed by the Docker CLI.
2. **Context Overriding:** Because the temporary cache directory has no logical connection to your source code, Docker Compose overrides its default relative path resolution. It dynamically binds the **Working Directory (the directory where your terminal is sitting when you run the command)** as the base context.
3. **Path Resolution:** Every relative path inside that remote `compose.yaml` (such as `.:/app` or `./config:/etc/config`) will be resolved relative to your **current active terminal directory**.

## Specifying Working Directory with `docker compose -f oci:...`

To force Docker Compose to look at the monorepo root instead of the local package folder, use the **`--project-directory`** (or `-c`) flag in your script:

```json
// packages/my-package/package.json
"scripts": {
  "docker:up": "docker compose -f oci://ghcr.io/... --project-directory ./dev up -d"
}
```

## Passing Environment Variables Dynamically to OCI Compose

Because the OCI artifact configuration is pulled down as a read-only snapshot, you cannot modify the file directly. Instead, you can pass runtime values using three native Docker Compose mechanisms:

### Method A: The Host Shell Environment (Most Dynamic)

Docker Compose automatically interpolates variables specified in your local shell environment into the `compose.yaml` file.

If your remote configuration looks like this:

```yaml
# Inside the remote OCI compose.yaml
services:
  backstage:
    image: node:20-bookworm-slim
    ports:
      - "${APP_PORT:-3000}:3000" # Fallback to 3000 if not provided
```

You can pass variables inline directly before your Turbo or script command:

```bash
APP_PORT=8080 yarn turbo run docker:up
```

### Method B: Local `.env` Files (Project-Level Defaults)

Docker Compose always looks for a file named `.env` in the active working directory (or the folder defined by `--project-directory`).

1. Create a `.env` file at your **monorepo root**:

   ```env
   DATABASE_URL=postgres://user:pass@localhost:5432/db
   NODE_ENV=development
   ```

2. When your script executes the OCI command (using the `--project-directory` fix from question 1), Compose will automatically read this local file and inject the variables into the containers.

### Method C: Passing Explicit Environment Files (`--env-file`)

If you want to support multiple configurations (e.g., local development vs. a shared staging playground), you can maintain separate environment files in your workspace and pass them explicitly using the `--env-file` flag:

```bash
docker compose -f oci://... --env-file ../../.env.staging up -d
```

## Unified Environment Variables & CI/CD Strategy

To seamlessly feed environment variables to **Docker Compose itself**, **pass them down into the Node.js application**, and **automate secure injection inside GitHub Actions**, you must pair Compose's native interpolation layout with GitHub's built-in encrypted secret store.

### Step A: Configure the OCI `compose.yaml`

To ensure a variable is read by both Compose and your Node.js code, you must explicitly declare it in the `environment` array of your service block.

```yaml
# Inside the remote OCI compose.yaml
services:
  backstage:
    image: node:20-bookworm-slim
    # 1. Compose reads this for host configurations
    ports:
      - "${HOST_PORT:-3000}:3000" 
    working_dir: /app
    volumes:
      - .:/app
      - /app/node_modules
    # 2. Compose maps host env variables down into the Node process container
    environment:
      - NODE_ENV=${NODE_ENV:-development}
      - DATABASE_URL=${DATABASE_URL}
      - THIRD_PARTY_API_KEY=${THIRD_PARTY_API_KEY}
```

*Note: If you omit the `environment` key in the YAML, your Node.js app (`process.env.DATABASE_URL`) will return `undefined`, even if the variable exists on your host terminal.*

### Step B: Local Workspace Setup (Developers)

Your developers do not need to type these out manually every time. In the root of the designated `--project-directory` (your `./dev` folder), create a local `.env` file:

```env
# ./dev/.env
HOST_PORT=8080
NODE_ENV=development
DATABASE_URL=postgres://localhost:5432/dev_db
THIRD_PARTY_API_KEY=local_dev_key_123
```

When a developer runs your remote OCI command, Compose targets the `./dev` folder, detects the `.env` file automatically, scales the ports, and passes the variables safely into the container.

### Step C: Secure Automation in GitHub Actions

In automated environments like GitHub Actions, you should **never** commit a `.env` file. Instead, store your credentials as **Repository Secrets** inside your GitHub repository settings.

To pass them automatically without breaking the remote OCI architecture, inject your secrets inline as environment variables directly targeting the step running your script.

Here is the exact production workflow definition:

```yaml
# .github/workflows/ci.yml
name: Integration Tests

on:
  push:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Start Remote Container Workspace
        # Map GitHub Encrypted Secrets directly to the host environment execution context
        env:
          HOST_PORT: 3000
          NODE_ENV: test
          DATABASE_URL: ${{ secrets.DB_PRODUCTION_URL }}
          THIRD_PARTY_API_KEY: ${{ secrets.PROD_API_KEY }}
        run: |
          # The execution inherits the 'env' context block perfectly
          docker compose -f oci://ghcr.io/your-org/workbench-compose:v1.0.0 --project-directory ./dev up -d
          
      - name: Verify Application Health
        run: |
          sleep 5
          curl http://localhost:3000/health
```

## Environment Variable Interpolation with Turbo (non-containerized)

he cleanest, industry-standard method for a **Turbo monorepo** is to use **environment variable interpolation powered by a root-level `.env` file and managed by Turbo's native environment filtering.**

This approach ensures developers only have to configure their database and service URLs in *one single place*, and both your local Node.js processes and your Docker Compose infra stack will automatically align.

Here is the step-by-step implementation blueprint.

### Step 1: Create a Centralized Configuration File

At the **root** of your monorepo, create a `.env.example` file to commit to Git, and a `.env` file for local use (add `.env` to your root `.gitignore`).

```ini
# <root>/.env
# =========================================================================
# Infrastructure Configuration (Read by Docker Compose & Host Node Process)
# =========================================================================
POSTGRES_USER=postgres
POSTGRES_PASSWORD=local_development_secret
POSTGRES_DB=workbench_db
DB_HOST=localhost
DB_PORT=5432

# =========================================================================
# Dynamic Connection Strings (Consumed directly by your Backstage apps)
# =========================================================================
DATABASE_URL=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${DB_HOST}:${DB_PORT}/${POSTGRES_DB}?sslmode=disable
TEMPORAL_ADDRESS=localhost:7233
MEM0_HOST=localhost:8000
```

### Step 2: Configure Your Infrastructure Docker Compose File

Design your supporting stack `docker-compose.infra.yml` to read these variables directly. When you run Docker Compose, it automatically looks for a `.env` file in the directory it is executed from to interpolate values.

```yaml
# <root>/docker-compose.infra.yml
services:
  postgres:
    image: ankane/pgvector:latest # Postgres optimized with pgvector
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "${DB_PORT}:5432" # Binds container 5432 to host port (e.g. 5432)
    volumes:
      - pgdata:/var/lib/postgresql/data

  temporal:
    image: temporalio/auto-setup:latest
    ports:
      - "${TEMPORAL_ADDRESS##*:}:7233" # Extracts the port from the address string
    environment:
      - DB=postgresql
      - POSTGRES_SEEDS=postgres
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PWD=${POSTGRES_PASSWORD}

volumes:
  pgdata:
```

### Step 3: Wire Turbo to Safely Feed Variables to Node

By default, standard Node.js scripts won't automatically read a root `.env` file when executed from a nested package directory (`packages/my-backend-plugin`).

Instead of cluttering your code with runtime loaders like `dotenv`, let **Turborepo** handle the injection natively. Turbo has built-in environment parsing capabilities that pull variables from the root `.env` and pass them down safely into the workspaces.

Update your root `turbo.json`:

```json
// <root>/turbo.json
{
  "$schema": "https://turbo.build",
  "globalDotEnv": [".env"], 
  "globalEnv": [
    "NODE_ENV",
    "DATABASE_URL",
    "TEMPORAL_ADDRESS",
    "MEM0_HOST"
  ],
  "pipeline": {
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

Why `globalDotEnv` is powerful here:

When a developer runs `yarn turbo run dev`, Turbo reads the root `.env` file, parses out `DATABASE_URL`, hooks it directly into the execution environment of the spawned workspace sub-shells, and tracks it. If a variable changes, Turbo knows how it affects your task hashes.

### Step 4: The Clean Developer Workflow

Your developers now enjoy a smooth, native development cycle using just two terminal tabs:

**Terminal Tab 1: Boot up your supporting infrastructure stack**

```bash
docker compose -f docker-compose.infra.yml up -d
```

Docker spins up `pgvector`, binds it to `localhost:5432`, and creates your database using the credentials in `.env`

**Terminal Tab 2: Run your monorepo servers at bare-metal speeds**

```bash
yarn turbo run dev
```

## Importing from `/src` from `/dev` in a single package

***This would only work where no plugin needs to use `workspace:^` resolution to another plugin in the same repo: so only Drivers***

To fix this so that relative paths work perfectly while keeping configuration clean, you should shift your project directory up to the **package root** (or the monorepo root) and adjust the destination directories inside the container.

### 1. Keep the Project Directory at the Package Level

Target the package directory so that both `dev/` and `src/` are included in the mounting context:

```bash
docker compose -f oci://ghcr.io/... --project-directory . up -d
```

### 2. Update the Volumes block in your remote OCI Compose File

Change the OCI `compose.yaml` file so it mounts the whole package context to `/app`, but maps the container's operational focus directly to the `dev` environment:

```yaml
services:
  workbench:
    image: node:20-bookworm-slim
    # Mount the package root so /app contains both /app/dev and /app/src
    volumes:
      - .:/app
      - /app/node_modules
    # Tell the container to execute processes from inside the dev directory
    working_dir: /app/dev
    command: ["yarn", "tsx", "index.ts"]
```

How this resolves the import:

1. When the container mounts `.`, `/app/dev/index.ts` and `/app/src/index.ts` both exist inside the container.
2. The runtime starts inside `/app/dev`.
3. When `dev/index.ts` calls `../src/index`, Node.js walks up to `/app`, moves into `/app/src/index.ts`, and resolves the file natively without ever trying to escape the container.

## Path Aliases Between Plugins: Monorepo-Wide Mounting

Because `my-backend-plugin` and/or `my-frontend-plugin` rely on a shared workspace sibling (`my-backend-plugin-node`), you cannot isolate your mounting boundary to just a single package directory. If you mount only `my-backend-plugin`, the container will follow the symlink in `node_modules` and find a broken link pointing to a folder (`my-backend-plugin-node`) that doesn't exist inside the container.

To make this work flawlessly, the container must have access to the entire monorepo layout so that Yarn's workspace symlinks remain completely intact.

### 1. The Remote OCI `compose.yaml` Structure

Design your remote OCI Compose file to assume it is being mounted at the **monorepo root**, but use the `working_dir` configuration to hyper-focus on the specific plugin you want to run.

```yaml
# Inside the remote OCI compose.yaml
services:
  plugin-runner:
    image: node:22-bookworm-slim
    # 1. Mount the entire monorepo so sibling packages and root node_modules exist
    volumes:
      - .:/app
      - /app/node_modules # Shield root dependencies
    # 2. Tell Compose to execute commands directly inside the target plugin
    working_dir: /app/packages/my-feature/${TARGET_PLUGIN_DIR}
    # 3. Dynamic target command (e.g., yarn dev)
    command: ["yarn", "dev"]
    environment:
      - NODE_ENV=development
```

### 2. The Developer Launch Command

When developers execute this, they run it from the **monorepo root** (or explicitly pass `--project-directory` pointing to the root), and feed the targeted plugin folder name as an environment variable:

```bash
# To run the backend plugin
TARGET_PLUGIN_DIR=my-backend-plugin docker compose -f oci://ghcr.io/... --project-directory . up -d

# To run the frontend plugin
TARGET_PLUGIN_DIR=my-frontend-plugin docker compose -f oci://ghcr.io/... --project-directory . up -d
```

## Coordinating Package and Root Scripts for Docker Compose

In the above, we are passing a `TARGET_PLUGIN_DIR` env var to `docker compose` that is reasonably only known by plugin packages (unless we maintain a mapping table in the repo root), but the `docker compose` command receiving that env var needs to be executed from the repo root so that it picks up the global `node_modules` directory that has workspace resolutions (symlinks for monorepo packages included in other monorepo packages as dependencies).

Turbo allows you to pass local workspace variables directly down to universal root-level pipeline configurations.

### 1. In your `turbo.json` (Root):

Declare `TARGET_PLUGIN_DIR` as a global environment variable environment flag so Turbo tracks it correctly across your container pipelines.

```json
// <root>/turbo.json
{
  "globalPassThroughEnv": ["TARGET_PLUGIN_DIR"],
  "pipeline": {
    "start-server": {
      "cache": false
    }
  }
}
```

### 2. In your Root `package.json`:

Map the generic command directly to Docker:

```json
// <root>/package.json
"scripts": {
  "start-server": "docker compose -f oci://ghcr.io/... --project-directory . up -d"
}
```

### 3. In your Nested Package `package.json`:

Simply use Turbo's filtering to trigger the root runner directly:

```json
// packages/my-feature/my-backend-plugin/package.json
"scripts": {
  "start-server": "TARGET_PLUGIN_DIR=my-backend-plugin yarn turbo run start-server --filter=."
}
```

## Advantages of the Turbo Approach for Executing Docker Compose


### 1. Native Pipeline Dependency Aware (Crucial for Plugin Pairs)

This is the single biggest differentiator for your my-backend-plugin and my-backend-plugin-node architecture.
If your shared node package needs to be compiled (e.g., building .ts to .js or generating types) before your dev container spins up, Turbo handles this automatically using pipeline dependencies.

### 2. Environment Variable Control and Security (`globalPassThroughEnv`)

Docker Compose requires host environment variables to orchestrate its configuration.

- In **Solution 1**, any variable you type in the terminal blindly drops into the shell. If a developer forgets a variable or introduces a typo, it silently defaults or fails unexpectedly.
- In **Solution 2**, Turbo acts as an strict gatekeeper. By declaring variables in `globalPassThroughEnv` (or under a task's specific `env` configuration block), Turbo explicitly validates and passes exactly what is requested, reducing human error.

### 3. Log Aggregation and Workspace Scoping

When your monorepo scales to have multiple backend plugins or frontend pairs, Turbo seamlessly handles log prefixes. Running a script through Turbo prefixes every line of output with the package scope (e.g., `my-backend-plugin: [docker] ...`), allowing you to tell exactly which workspace initialized a remote container process when scrolling through deep console histories.

## Convenient Docker Compose Commands

If you ever want to check what is happening inside those background infrastructure containers, you can use these supporting commands:

- **View a point-in-time snapshot of logs:**

  ```bash
  docker compose -f docker-compose.infra.yml logs
  ```

- **Actively tail/stream the logs (without locking your main boot tab):**

  ```bash
  docker compose -f docker-compose.infra.yml logs -f
  ```

- **Check the health and port statuses of the running backing stack:**

  ```bash
  docker compose -f docker-compose.infra.yml ps
  ```

## Health Checks

Here is your finalized, production-ready **`docker-compose.infra.yml`** alongside the scripts for your `package.json`.

There are two critical technical nuances implemented below to prevent common local development errors:

1. **The TCP Port Health Check for Postgres:** A basic `pg_isready` check can report a success state while Postgres is still bound strictly to internal Unix sockets. To make sure your host machine can reach it immediately when the terminal returns, the health check explicitly tests the external-facing TCP port (`-h 127.0.0.1`).
2. **The Temporal Health Probe:** The `temporalio/auto-setup` image has been deprecated by Temporal in favor of explicitly managed service roles. However, if you are utilizing an image that packages the core services together for local workspaces, it will not have the `temporal` CLI installed inside the runtime container. The most robust, universal way to check its health without extra tools is to verify the gRPC frontend socket state using standard network tools like `nc` (netcat) or `timeout /dev/tcp`.

### Step 1: Configured `docker-compose.infra.yml`

```yaml
# <root>/docker-compose.infra.yml
services:
  postgres:
    image: ankane/pgvector:latest
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "${DB_PORT:-5432}:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    # Native Healthcheck: Validates TCP network readiness, not just socket readiness
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -p 5432 -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 3s
      timeout: 3s
      retries: 5
      start_period: 2s

  temporal:
    image: temporalio/auto-setup:latest
    ports:
      - "${TEMPORAL_ADDRESS##*:}:7233"
    environment:
      - DB=postgresql
      - POSTGRES_SEEDS=postgres
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PWD=${POSTGRES_PASSWORD}
    # Delays startup execution loop until Postgres passes its TCP test string
    depends_on:
      postgres:
        condition: service_healthy
    # Temporal Healthcheck: Probes the active gRPC port layer inside the container
    healthcheck:
      test: ["CMD-SHELL", "nc -z localhost 7233 || exit 1"]
      interval: 4s
      timeout: 3s
      retries: 10
      start_period: 5s

volumes:
  pgdata:
```

### Step 2: The Shell Automation Control Scripts

Add these three target configurations to your **root `package.json`** file to handle your startup gates and local volume nukes cleanly.

```json
// <root>/package.json
"scripts": {
  "infra:up": "docker compose -f docker-compose.infra.yml up -d --wait",
  "infra:down": "docker compose -f docker-compose.infra.yml down",
  "infra:reset": "docker compose -f docker-compose.infra.yml down -v"
}
```

### Detailed Operations Profile

- **`yarn infra:up` (The Blocking Boot):**
  By appending **`--wait`**, Docker Compose fires up the background daemons but actively holds your cursor stream hostage. Your terminal will display a live status indicating `Health: Starting`. It evaluates the health loops every few seconds and will only drop control back to your prompt when Temporal is completely initialized and ready to register workflow clients.
- **`yarn infra:down` (The Local Pause):**
  Gracefully stops the runtime processes but leaves your database states completely intact. This is ideal for ending your workday without losing your persistent app tokens.
- **`yarn infra:reset` (The Storage Wipe):**
  The addition of the **`-v` flag** instructs Docker to dismantle the engine blocks and instantly **destroy the `pgdata` volume** from your storage disk. This gives you an absolute blank slate to clear out bloated test histories or dirty schemas.

## How to execute the build from the root correctly

Running `docker build` from the root is necessary to be able to resolve required workspace package dependencies. To build your image from the repository root while pointing to a Dockerfile nested deep inside your app folder, you use the **`-f` (or `--file`)** flag to specify the path to the Dockerfile.

From your **monorepo root**, run:

```bash
docker build -f apps/backstage/Dockerfile -t my-backstage-app .
```

- **`-f apps/backstage/Dockerfile`**: Tells Docker where to find the build script.
- **`.`**: Sets the **monorepo root** as the Build Context, giving Docker access to all your apps, packages, and lockfiles.

## How `turbo prune` Modifies What Lands in `COPY . .`

When you have a massive monorepo with 20 apps, a standard `COPY . .` from the project root pulls in every single file, forcing Docker to invalidate its build cache whenever *any* file in the monorepo changes. `turbo prune` helps by only copying the workspace dependencies required by the scoped directory.

`turbo prune --scope=backstage --docker` prevents this by slicing your repository into two distinct, highly optimized folders inside an `/out` directory:

1. **`out/json/` (The Configuration Slice):** Contains *only* the `package.json` files and monorepo configurations (`turbo.json`) required to determine your app's dependency tree. **It strips out all source code files** (`.ts`, `.tsx`, etc.).
2. **`out/full/` (The Code Slice):** Contains the actual source files and internal monorepo packages that your specific target application (`backstage`) requires to run and build.

### Visualizing how `turbo prune` rewires the `COPY` steps:

Instead of running a heavy `COPY . .` of your raw workspace, your Dockerfile utilizes multi-stage caching by leveraging those two separate outputs:

```dockerfile
# --- Step A: Copy only the dependency configurations ---
COPY --from=skeleton /app/out/json/ .
COPY --from=skeleton /app/out/yarn.lock ./yarn.lock

# Docker Cache Hit! 🟢 
# This layer ONLY re-runs if a package.json or yarn.lock changes. 
# If you just edit a component file, Docker skips this heavy yarn install.
RUN yarn install --immutable

# --- Step B: Copy the source files ---
COPY --from=skeleton /app/out/full/ .

# Docker Cache Miss 🟡 (Runs only when source code changes)
RUN yarn turbo run build --filter=backstage
```

By allowing `turbo prune` to generate these isolated folders, you trick Docker into caching your heavy `node_modules` installation step, decreasing subsequent image build times from minutes down to seconds.

### 📁 Example of `turbo prune` Layout

Imagine you have a monorepo with this original structure on your host machine:

```text
my-monorepo/
├── package.json (root)
├── turbo.json
├── apps/
│   ├── backstage/         <-- Your target app
│   │   └── package.json   (depends on "shared-utils")
│   └── marketing-site/    <-- Unrelated app
│       └── package.json
└── packages/
    ├── shared-utils/      <-- Internal shared library
    │   └── package.json
    └── legacy-auth/       <-- Unrelated internal library
        └── package.json
```

When you run `turbo prune --scope=backstage --docker`, Turbo generates an `out/` folder containing two configurations:

#### 1. Inside `out/json/` (Only configurations)

This folder completely deletes the `marketing-site` and `legacy-auth` entries because `backstage` doesn't use them. It leaves behind **only package files with their code completely stripped out**:

```text
out/json/
├── package.json (root)
├── turbo.json
├── apps/
│   └── backstage/
│       └── package.json
└── packages/
    └── shared-utils/
        └── package.json
```

**Why?** You copy this folder into Docker *first* and run `yarn install`. Because there is zero source code here, editing a TypeScript file in `backstage` won't change any files in `out/json/`. Docker sees that these configuration files are identical to the last build, hits a **cache match**, and completely skips running your slow `yarn install` step.

#### 2. Inside `out/full/` (Only relevant source code)

Once `yarn install` finishes successfully using the cache, you pull in the actual code files. `out/full/` contains the actual logic, but **completely omits the unrelated apps**:

```text
out/full/
├── apps/
│   └── backstage/
│       └── src/
│           └── index.ts   (Actual code)
└── packages/
    └── shared-utils/
        └── src/
            └── index.ts   (Actual code)
```

## Docker's Advanced File System Mounting Syntax

If you want to bypass copying files entirely, optimize performance, or handle special files like symlinks without resolving them into massive duplicated data on your disk, you use **Cache and Bind Mounts** via the `RUN --mount` flag.

This tells Docker to temporarily mount a directory from your host machine (or a cache engine) *only during the execution of that specific line*, without baking those host files into the final image layers.

### Example 1: The Cache Mount (Speeds up yarn/npm installs)

Instead of copying package managers' global cache folders into your image, you can tell Docker to use a persistent build cache. If you run the build again, Docker reuses the existing cache directory on your machine.

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json yarn.lock ./

# Mount the global yarn cache directory dynamically during installation
RUN --mount=type=cache,target=/root/.yarn/berry/cache \
    yarn install --immutable
```

### Example 2: The Bind Mount (Executing code without a `COPY` step)

Instead of running a heavy `COPY . .` which permanently inflates your image size with build tools, you can temporarily mount your host files, compile your project, and output the compiled code straight into the container image filesystem.

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

# 1. Mount the current host folder directly into /src inside the container
# 2. Compile the application
# 3. The output goes into /app/dist (which persists in the image)
# 4. When this line finishes, the /src mount disappears, leaving no trace of your original source code files!
RUN --mount=type=bind,source=.,target=/src \
    cd /src && yarn turbo run build --filter=backstage && cp -r /src/apps/backstage/dist /app/dist.
```

### Example 3: Handling Secret Keys securely

If your monorepo requires an `.env` file or an NPM token to fetch private packages, never use `COPY .env .`. It leaves a permanent security footprint in your image layers. Use a secret mount instead:

```dockerfile
# Mounts the file securely. It is completely invisible in the final image layers.
RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN=$(cat /run/secrets/npm_token) npm install
```

## `COPY --from=`

The syntax `COPY --from=<name>` is a universal Docker feature. It tells Docker to pull files from a resource **outside of the current container's build folder**.

You can use `COPY --from=`

 to copy files from **three completely different types of sources** depending on what name you put after the `--from=` flag:

### 1. From a Previous Stage (What you saw earlier)

If the name matches a previous `FROM ... AS <name>` statement in your Dockerfile, it copies files from that earlier stage.

```dockerfile
FROM node:20 AS builder
# ... builds app into /app/dist ...

FROM node:20-alpine AS runner
# Copies from the temporary "builder" stage above
COPY --from=builder /app/dist /app/dist 
```

### 2. From any Remote Image or OCI Registry (GHCR, Docker Hub, Zot)

If the name doesn't match a stage inside the file, Docker treats it as a **remote image tag**. It will automatically reach out to your registry, download that image, extract the files you asked for, and throw the rest of the image away. **You don't even need to include a `FROM` statement for it.**

```dockerfile
FROM node:20-alpine AS runner
WORKDIR /app

# Directly pulls the image from GHCR, extracts a file, and leaves
COPY --from=ghcr.io/your-org/backstage-workbench:latest /app/package.json ./shared-package.json
```

### 3. From an `additional_contexts` block (The Docker Compose method)

If the name matches a key you defined inside the `additional_contexts` block of your `docker-compose.yml`, Docker maps it directly to that local folder or OCI layout.

```yaml
# In docker-compose.yml
additional_contexts:
  workbench-cache: docker-image://ghcr.io/your-org/cache:latest
```

```dockerfile
# In Dockerfile
FROM node:20-alpine
# Copies from the context defined in your compose file
COPY --from=workbench-cache /cache/data ./data 
```

## 🚀 How to make those Cache Misses blazing fast

Since you are using a modern monorepo setup, you can dramatically speed up the build time even when the cache breaks by using **Docker BuildKit Cache Mounts**.

Instead of letting Yarn download everything from the internet from scratch on a cache miss, you can tell Docker to keep a persistent package cache folder on the host machine. You do this by altering the installation line in your Dockerfile:

```dockerfile
# Replace your standard yarn install line with this:
RUN --mount=type=cache,target=/root/.yarn/berry/cache \
    yarn install --immutable
```

What this does during a cache miss:

1. Docker recognizes the `yarn.lock` changed and triggers a cache miss ❌.
2. Instead of an empty folder, Docker plugs your host machine's global Yarn cache directory directly into `/root/.yarn/berry/cache` inside the container.
3. Yarn runs, notices the lockfile changed, but finds 99% of the required files already downloaded locally in that cache.
4. Your `yarn install` finishes in 5–10 seconds instead of several minutes.
