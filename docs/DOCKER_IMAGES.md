# 🌐 Dockerfiles Notes

## Dynamically Configuring a Dockerfile: ENV vs. ARG

You cannot use runtime environment variables (`ENV`) to dynamically change *how* a Dockerfile builds (e.g., you can't use an `ENV` to conditionally change a `RUN` statement or an image tag).

### The Difference Between ARG and ENV

- **`ARG` (Build-Time Variables):** This is the **best and only way** to dynamically configure a Dockerfile's compilation behavior. They are stripped out once the image is built.
- **`ENV` (Runtime Environment Variables):** These have no power during the build phase itself; they dictate application state *after* the container boots.

### Using ARG in a Dockerfile

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

Conditional syntax:

```dockerfile
ARG INSTALL_TEST_TOOLS 

WORKDIR /app
# ... copy files and install ...

# Use the ARG in a conditional shell statement
RUN if [ "$INSTALL_TEST_TOOLS" = "true" ]; then yarn install --dev; fi
```

### Specifying ARG Values with Docker Build

To replicate your exact Docker Compose configuration using the CLI, you would run:

```bash
docker build \
  --target dev \
  --build-arg NODE_VERSION="20-bookworm" \
  --build-arg INSTALL_TEST_TOOLS="true" \
  -t my-backstage-app:dev .
```

### Specifying ARG Values with Docker Compose

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

## How to Pull and Run Remote Dockerfiles

### Pulling from a Directory in a Remote Repo

If your `workbench` repo holds the core `Dockerfile` used to boot Backstage, your downstream repository can instruct Docker to download that Git repository and build the container out of it remotely:

```yaml
services:
  backstage-workbench:
    build:
      # 1. Provide the URL to the remote repository as the context
      context: https://github.com/ai-crew-suite/workbench
      # 2. Tell it exactly where the Dockerfile is located inside that repo
      dockerfile: ./packages/dockerfiles/backstage-server-node22-backend/Dockerfile 
```

### Pull a Base Image from your Registry

If your goal is to have a "base workbench image" that already has the foundation for Backstage, you shouldn't use the `context` field for this. Instead, build that base image once, push it to GHCR/Zot, and reference it right inside your downstream `Dockerfile`:

```dockerfile
# Inside your downstream repo's Dockerfile
FROM ghcr.io/your-org/backstage-workbench:latest AS base

WORKDIR /app
COPY . .
RUN yarn turbo run build --filter=backstage
```

### Share Multiple OCI Layouts via `additional_contexts` (Advanced)

If you are generating a localized filesystem state in a tool like Bazel, saving it as a raw OCI-layout directory, and you want to pass that directly into a build as an extra set of files, newer versions of Docker Compose support **`additional_contexts`**.

This allows you to pipe an uncompressed OCI directory layout into a running build context:

```yaml
services:
  backstage-workbench:
    build:
      context: . # Your local app code
      additional_contexts:
        # Pulls from a local OCI layout folder containing dependencies
        workbench-cache: oci-layout://./path/to/zot/or/local/layout 
```

Inside the Dockerfile, you would access those files via `COPY --from=workbench-cache`.

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

#### Terraform Synchronization

If your Terraform files provision the infrastructure (like EKS, ECS, VPCs) and pass variables down to your Helm provider, you can simply inject the generated image tag dynamically as an input variable into your Terraform workspace runner.

To seamlessly tie your freshly built Docker image directly into your CD pipeline using the short Git commit SHA, you can combine your build jobs and deployment jobs into a single unified GitHub Actions workflow.

Here is exactly how to wire up that automated handoff, followed by the solution for your developers running Windows host machines.

#### Automated CD Handoff via short SHA

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

## Windows Users: Mandate WSL 2 with Ubuntu

To **mandate WSL 2 with Ubuntu**, you cannot programmatically lock a user's operating system, but you can configure your repository's environment check to fail immediately with a clear error message if a Windows developer attempts to run your workbench tools outside of a proper Linux environment.

Here is how you can implement this barrier via **documentation, environment gating, and terminal assertions**.

### Documentation Blueprint for Windows Users

To make the onboarding friction as low as possible, your repository's `README.md` should have a dedicated, copy-pasteable installation block specifically for Windows users.

```markdown
## 💻 Windows Prerequisites (WSL 2 Mandatory)

Native Windows (PowerShell, Command Prompt, or Git Bash) is **not supported** due to shell script compatibility and multi-container Docker volume performance. 

To set up your environment:

1. Open PowerShell as Administrator and install WSL 2 with Ubuntu:

\`\`\`powershell
wsl --install -d Ubuntu
\`\`\`

2. Restart your computer when prompted.
3. Open the **Ubuntu** application from your Windows Start Menu and complete the Unix username/password setup.
4. Download and install [Docker Desktop for Windows](https://docker.com).
5. Open Docker Desktop settings, navigate to **General**, and ensure **Use the WSL 2 based engine** is checked.
6. Navigate to **Resources > WSL Integration**, and toggle on **Ubuntu**.

From this point forward, **always** clone this repository and run all commands inside your Ubuntu terminal window.
```

### The Environment Gate (Fail Early in Tooling)

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

### Block Execution on Native Windows

Here is how to set up both the **automated package.json lifecycle gate** to physically block execution on native Windows, and the **VS Code Devcontainer setup** to guide Windows users into a functional WSL 2 environment automatically.

#### The `package.json` Environment Gate

You can use a custom Node script hooked into the `prestart` or `predev` lifecycles of your `package.json`. If a user attempts to boot the workbench from native PowerShell, CMD, or Git Bash, the script will kill the process immediately and print instructions.

#### Create the Gate Script (`scripts/check-env.js`)

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

#### Wire it into `package.json`

Hook this script into whichever commands the developers run locally. By prefixing your command with `pre`, npm/yarn/pnpm will automatically force it to run first:

```json
"scripts": {
  "predev": "node scripts/check-env.js",
  "dev": "my-dev-env up"
}
```

### The VS Code Devcontainer Setup

The absolute best way to "mandate" WSL 2 seamlessly for Windows developers (while also helping Mac users) is to provide a `.devcontainer/devcontainer.json` file in your repository.

When a Windows developer clones your repository using **VS Code**, VS Code will detect this file and display a prompt: *"Reopen in Container"* or *"Reopen in WSL"*.

**Why this works:** To use Devcontainers on Windows, VS Code natively forces the user to install WSL 2 and Ubuntu behind the scenes. It automates your environment mandate for you through IDE tooling.

#### Create a `.devcontainer` directory

Inside your project root, create a directory named `.devcontainer`. Inside it, create two files: `devcontainer.json` and a `Dockerfile`.

#### `.devcontainer/Dockerfile`

This ensures the environment running inside the Devcontainer has Docker installed so it can talk to the host machine's Docker engine (Docker-outside-of-Docker).

```dockerfile
FROM ://microsoft.com

# Install standard tools needed for the workbench curl functionality
RUN apt-get update && apt-get install -y \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*
```

#### `.devcontainer/devcontainer.json`

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
