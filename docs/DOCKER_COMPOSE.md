# 🌐 Docker Compose Notes

## Executing inside Third-Party Repositories

When engineers spin up your infrastructure remotely from the root of their custom plugin paths, they pass the active directory boundaries on the fly:

```bash
export PROJECT_DIR="$(pwd)"
export WORKING_DIR="/app"
export MEM0_PROVIDER_API_KEY="sk-..."

docker compose -f /path/to/shared/compose.yaml --project-directory "$PROJECT_DIR" up -d
```

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

## Volumes

### Bind Mounting Anonymous Volumes

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
### Volume States

The `-v` or `--volumes` flag explicitly tells Docker to delete named volumes declared in the `volumes` section of the Compose file, as well as any **anonymous volumes** attached to the containers. Without the `-v` flag, both named and anonymous volumes persist, and your data remains completely intact on your host machine. In your GitHub Actions pipeline, you do not want data persisting between separate workflow runs.  

```yaml
      # Inside your github actions pipeline
      - name: Stop Dev Stack & Purge Volumes
        if: always()
        run: |
          curl -s https://githubusercontent.com/repo | \
          docker compose -f - --project-directory "$(pwd)" down -v
```

## Compose File Execution Dynamics

### How the Host Path `.` is Determined

**It is determined by the directory from which you execute the `docker compose` command**, but with a slight caveat depending on how you reference your file. Specifically:

- By default, Docker Compose resolves relative paths (like `.`) relative to the **directory of the `docker-compose.yml` file itself**, regardless of where your terminal is sitting.
- However, if you use the `-f` flag to point to a file in a different directory (e.g., `docker compose -f ../docker-compose.yml up`), `.` will still resolve relative to that targeted configuration file, not your active terminal path.

### Host Path Resolution with OCI Artifacts (`oci://`)

When you run `docker compose -f oci://... up -d`, the behavior changes because there is no local file on disk to act as a baseline. **The `.` host path resolves to the directory from which you execute the `docker compose` command.**

Here is exactly what happens behind the scenes:

1. **Downloading to a Cache:** Docker Compose pulls the OCI artifact (which contains your `compose.yaml`) down from the remote registry. It unpacks the configuration file into a volatile, temporary cache directory managed by the Docker CLI.
2. **Context Overriding:** Because the temporary cache directory has no logical connection to your source code, Docker Compose overrides its default relative path resolution. It dynamically binds the **Working Directory (the directory where your terminal is sitting when you run the command)** as the base context.
3. **Path Resolution:** Every relative path inside that remote `compose.yaml` (such as `.:/app` or `./config:/etc/config`) will be resolved relative to your **current active terminal directory**.

### Specifying Working Directory with `docker compose -f oci:...`

To force Docker Compose to look at the monorepo root instead of the local package folder, use the **`--project-directory`** (or `-c`) flag in your script:

```json
// packages/my-package/package.json
"scripts": {
  "docker:up": "docker compose -f oci://ghcr.io/... --project-directory ./dev up -d"
}
```

### Using `--project-directory` in Monorepo Setups

When using the `--project-directory "$(pwd)"` flag, Docker Compose dynamically changes the **project namespace** based on the directory the developer is standing in.

```bash
curl -s https://githubusercontent.com/repo | \
docker compose -f - --project-directory "$(pwd)" up
```

This guarantees that packages keep their vectors and databases completely separate, even though both are pulling down the exact same `curl` string from your core repository.

### Use `working_dir` to Point to Plugin Folder

Because `my-backend-plugin` and/or `my-frontend-plugin` rely on a shared workspace sibling (`my-backend-plugin-node`), you cannot isolate your mounting boundary to just a single package directory. If you mount only `my-backend-plugin`, the container will follow the symlink in `node_modules` and find a broken link pointing to a folder (`my-backend-plugin-node`) that doesn't exist inside the container. To make this work flawlessly, the container must have access to the entire monorepo layout so that Yarn's workspace symlinks remain completely intact.

#### The Remote OCI `compose.yaml` Structure

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

#### The Developer Launch Command

When developers execute this, they run it from the **monorepo root** (or explicitly pass `--project-directory` pointing to the root), and feed the targeted plugin folder name as an environment variable:

```bash
# To run the backend plugin
TARGET_PLUGIN_DIR=my-backend-plugin docker compose -f oci://ghcr.io/... --project-directory . up -d

# To run the frontend plugin
TARGET_PLUGIN_DIR=my-frontend-plugin docker compose -f oci://ghcr.io/... --project-directory . up -d
```

### Local Layout Configuration Overrides

External developers should not modify the core docker compose source files directly. They drop a localized `compose.override.yaml` file into their `dev` directory to adapt configurations on their machines. The system safely combines layers without creating file conflicts.

If using a local override in a package, you could use a different name for the override (or not) and pass it with an `-f` flag:

```bash
# Developers must chain the files manually. 
# The remote configuration is downloaded first, and the local file layers over it.
docker compose \
  -f oci://ghcr.io/your-org/workbench-compose:v1.0.0 \
  -f packages/my-plugin/workbench.override.yml \
  --project-directory . up -d
```

The command will strictly fail if `workbench.override.yml` is missing.

### `COMPOSE_FILE` is a Default Var That Replaces `-f`

The `COMPOSE_FILE` environment variable is a built-in Docker engine variable that can be used instead of `-f` parameters on your command line. The -`f` flag completely overrides and ignores the `COMPOSE_FILE` environment variable if the `-f` flag is present. Docker Compose reads the list of files in the `COMPOSE_FILE` variable from left to right and expects every single one of them to exist. If any file in that string is missing, Docker Compose will immediately crash with a fatal error.

```env
# <root>/.env
# Use a colon (:) on Linux/macOS, or a semicolon (;) on Windows to separate files
export COMPOSE_FILE="oci://ghcr.io/your-org/workbench-compose:v1.0.0:packages/my-plugin/workbench.override.yml"
```

#### Scenario A: Changing a Bound Network Service Port

If a developer runs local PostgreSQL configurations on port `5432` natively, they can safely proxy the OCI workbench engine module outbound loop targeting alternate channels:

```yaml
# workbench.override.yml
services:
  postgres:
    ports:
      - "5433:5432" # Changes the host-facing port without breaking interior overlay spaces
```

Docker Compose merges list arrays (like `ports`) by **appending** items rather than completely replacing them. However, because the interior target engine space is bound to standard interface mappings, mapping `5433:5432` binds the external host interface to `5433` while keeping the internal container architecture routing smoothly over the shared container layout.

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

Because the OCI-pulled registry template defines a common bridge network (usually defaulting to the project name namespace), declaring a brand new service block under the exact same service array allows the custom database instance to connect to the unified engine layer instantly.

## Using Docker Compose with a `my-dev-env` Shell Function

```bash
my-dev-env() {
  # Path to where your shared core compose file is downloaded/stored
  local COMPOSE_FILE="/path/to/shared/core/compose.yaml"
  
  # Inject the project directory globally before passing "$@" (up, down, etc.)
  docker compose -f "$COMPOSE_FILE" --project-directory "$(pwd)" "$@"
}
```

## Environment Variables

### Turbo and Environment Variables

The `globalPassThroughEnv` array simply tells Turbo: "If this variable happens to exist in the terminal shell where `turbo run` was invoked, do not strip it out; let it pass down to the spawned processes."

### Passing Environment Variables Dynamically to OCI Compose

Because the OCI artifact configuration is pulled down as a read-only snapshot, you cannot modify the file directly. Instead, you can pass runtime values using two native Docker Compose mechanisms. Docker Compose will also read a `.env` file and apply the variables from the directory it is launched from, but using that with the `--project-directory` flag pointing to package directories would require either `.env` files in every plugin folder or deep backtracking in relative file paths.

#### Passing Env Vars Inline from Terminal

Docker Compose automatically interpolates variables specified in your local shell environment into the `compose.yaml` file. If your remote configuration looks like this:

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

#### Passing Environment File Paths

If you want to support multiple configurations (e.g., local development vs. a shared staging playground), you can maintain separate environment files in your workspace and pass them explicitly using the `--env-file` flag:

```bash
docker compose -f oci://... --env-file ../../.env.staging up -d
```

### Passing Env Vars to a Containerized Node.js App

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

If you omit the `environment` key in the compose file, your Node.js app (`process.env.DATABASE_URL`) will return `undefined`, even if the variable exists on your host terminal.

### Configure Turbo Cache Invalidation and Handle Root `.env` Loading

Turborepo needs to know which environment variables affect your tasks. If a variable changes, Turbo needs to invalidate the cache and rerun the script. To do so, update your root `turbo.json` to include your environment variables in the global hash tracking:

```json
// <root>/turbo.json
{
  "$schema": "https://turbo.build",
  "globalEnv": [
    "NODE_ENV",
    "DATABASE_URL",
    "TEMPORAL_ADDRESS",
    "MEM0_HOST"
  ],
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

## Distributing Compose File via OCI Registry

Modern environments treat `docker-compose.yml` graphs as version-controlled **OCI Artifacts**. Instead of pulling raw files from Git or via `curl`, Docker Compose can publish, pull, and scale architectural topologies straight from **GitHub Container Registry (GHCR)**.

### Publishing to Local Zot Registry

The Zot Web UI is accessible at **`http://localhost:32443`** and images can be pushed via **`docker push localhost:32443/my-image:latest`** without managing passwords.

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

##### Create your execution task script (`scripts/infra.ts`)

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

##### Bind the script toolchain within `package.json`

```json
{
  "scripts": {
    "workbench": "ts-node scripts/infra.ts"
  }
}
```

##### Execution Usage

```bash
# Bring the remote stack up in background mode
npm run workbench up -d

# Target clean down configurations locally
npm run workbench down
```

## GitHub Actions Workflow for GHCR Publish

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

## 
