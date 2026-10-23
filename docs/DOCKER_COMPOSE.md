# 🌐 Workbench Planning

## Wrapping Backstage in Docker

Here is what the architecture looks like when containerizing the Backstage runtime inside the workbench while allowing consumer repos to overlay mock footprints natively.

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

## Docker Compose Volume Persistence

### Named vs. Anonymous Volumes

When mapping local code into a container using bind mounts, your host directory overlays the container file system entirely. If your host machine (Mac/Windows) has local dependencies like `node_modules` or build caches, it will overwrite the container's built dependencies (Linux), causing runtime errors.

```yaml
services:
  web:
    image: node:lts
    volumes:
      # This creates an anonymous volume mapped to this container path
      - /usr/src/app/node_modules
  database:
    image: postgres:15
    # 1. Mount the named volume inside the container
    volumes:
      - pgdata:/var/lib/postgresql/data

# 2. Declare the named volume at the top level
volumes:
  pgdata:
  # use a pre-existing volume instead of managing its lifecycle automatically
    external: true
```

By switching to named volumes, your developers can confidently manage their workflows without anxiety over losing data:

- **`my-dev-env down`**: This stops the containers and removes the isolated network bridge. However, the data volumes (`pgdata`) remain safely intact inside Docker's storage engine. Running `my-dev-env up` again seamlessly reconnects the database to its exact previous state.
- **`my-dev-env down -v`**: If a developer intentionally messes up a migration, populates bad mock data, or simply wants a completely clean slate, passing the native `-v` (volumes) flag tells Docker to purge the database and reset the volume to zero.

#### The Anonymous Volume Trick

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

#### Lifecycle & Mechanics

- **Container Boot:** During `docker compose up`, Docker creates an isolated cache for each unnamed path. It populates these volumes by copying the native Linux dependencies already baked into the image.
- **The Trapped State:** Code changes sync instantly across `. :/app`. However, if you run `yarn add` or `npm install` on your *host machine*, the container will not see it because the anonymous volume completely isolates that path.
- **Syncing New Packages:** Whenever you alter dependencies in your project files, you must force Docker to wipe and re-initialize its anonymous layers:

```bash
docker compose up -d --build --renew-anon-volumes
```

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

### Update the Centralized `docker-compose.yml`

*The context of this is setting up devcontainers, in the `DOCKER_IMAGES.md` file.*

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

## Docker Compose Distributed Stacks via OCI Artifacts

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

## Local Layout Configuration Overrides

External developers do not modify the core workspace source files directly. They drop a localized `compose.override.yaml` or `docker-compose.override.yml` into their working directory to adapt configurations on their machines. The system safely combines layers without creating file conflicts.

If using a local override in a package, you could use a different name for the override (or not) and pass it with an `-f` flag:

```bash
# Developers must chain the files manually. 
# The remote configuration is downloaded first, and the local file layers over it.
docker compose \
  -f oci://ghcr.io/your-org/workbench-compose:v1.0.0 \
  -f packages/my-plugin/workbench.override.yml \
  --project-directory . up -d
```

### `COMPOSE_FILE` is a Default Var That Replaces `-f`

The `COMPOSE_FILE` environment variable is a built-in Docker engine variable designed specifically to replace the clunky `-f` parameters on your command line.

Instead of forcing your developers to type a long string of chained `-f` flags every time they want to spin up a container, you can store those definitions directly inside a local `.env` file sitting at your project/workspace root:

```env
# <root>/.env
# Use a colon (:) on Linux/macOS, or a semicolon (;) on Windows to separate files
COMPOSE_FILE=oci://ghcr.io/your-org/workbench-compose:v1.0.0:compose.override.yaml
```

### Scenario A: Changing a Bound Network Service Port

If a developer runs local PostgreSQL configurations on port `5432` natively, they can safely proxy the OCI workbench engine module outbound loop targeting alternate channels:

```yaml
# workbench.override.yml
services:
  postgres:
    ports:
      - "5433:5432" # Changes the host-facing port without breaking interior overlay spaces
```

Docker Compose merges list arrays (like `ports`) by **appending** items rather than completely replacing them. However, because the interior target engine space is bound to standard interface mappings, mapping `5433:5432` binds the external host interface to `5433` while keeping the internal container architecture routing smoothly over the shared container layout.

### Scenario B: Injecting Custom Ephemeral Core Modules

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

## Using Docker Compose with a `my-dev-env` Shell Function

```bash
my-dev-env() {
  # Path to where your shared core compose file is downloaded/stored
  local COMPOSE_FILE="/path/to/shared/core/compose.yaml"
  
  # Inject the project directory globally before passing "$@" (up, down, etc.)
  docker compose -f "$COMPOSE_FILE" --project-directory "$(pwd)" "$@"
}
```
