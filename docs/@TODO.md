# Todos for Workbench Repo

## Workbench CLI

Move seeder CLI commands into Crew CLI.

## CSpell

CSpell is adding new words to `.vscode/settings.json` CSpell key instead of the root `cspell.json` file. This is probably a common issue across all repos.

## `compose-publish`

1. **Incorrect Context Working Directory (`cwd`)**:
   When using `oras push`, files passed to the CLI command (e.g., `compose.yml:application/vnd.docker.compose.file+yaml`) must exist relative to the working directory you supply to `spawnSync`. Your script correctly navigates to `cwd: path.dirname(composeFile)` (`packages/deploy/compose/src`), but the file name inside the source directory is actually `src/compose.yml`. Inside `src/`, the file is just `compose.yml`, so your media type definition mapping must be changed from `compose.yml:...` to match the exact file name in that folder.
2. **Local Registry Authentication Failure**:
   When pushing to a local Zot registry running on a loopback address (e.g., `localhost:5000`), Cosign will fail to sign the artifact because it defaults to HTTPS. You check for loopback addresses to apply `--plain-http` to the `oras` command, but you do **not** pass down an equivalent flag to your `SigningService`. Cosign requires `--allow-insecure-registry` to talk to plain HTTP registries.
3. **Cosign Keyless OIDC Execution Check**:
   You check `isCI` to trigger keyless OIDC signing. However, Cosign keyless signing will still fail in CI if the target repository requires credentials (like GHCR) and `cosign` doesn't have permissions, or if it isn't running inside a supported OIDC environment (GitHub Actions, GitLab CI, etc.). Your `SigningService` must be ready to catch or expect those environments.

## Architecture Blueprint: OCI-Driven Smart Orchestrator

### 1. Directory & File Topology

The architecture isolates the core execution tracks into clean, single-responsibility files inside the existing `workbench-cli` command domain:

```text
packages/workbench-cli/src/bin/commands/
├── compose-start/
│   ├── index.ts                # Main command definition and lifecycle orchestrator
│   └── lib/
│       ├── topology.ts         # PURE: Node/Backstage package nature parser
│       ├── oci.ts              # Programmatic ORAS-JS artifact retrieval engine
│       ├── cluster.ts          # Docker Compose subprocess controller
│       └── runner.ts           # Long-running Node development server manager
├── compose-stop/
│   └── index.ts                # Teardown command execution wrapper
└── __tests__/
    ├── topology.spec.ts        # Vitest suite for project nature detection assertions
    └── cluster.spec.ts         # Vitest suite for compose string formatting & lifecycle gates
```

### 2. Shared Specifications & Constants

To shield developers completely, these hardcoded global parameters govern the configuration envelopes:

- **Manifest Target Cache:** `/tmp/workbench-compose/compose.yaml`
- **Backstage Ports:** Backend runs on `7007`, Frontend runs on `3000`.
- **Fallback Registry Env Reference:** `process.env.REGISTRY || "ghcr.io/ai-crew-suite"`

### 3. Structural Component Blueprint Breakdown

#### Part A: Topology Detection Strategy (`lib/topology.ts`)

This module contains pure functions that do not execute operations directly on the live runtime environment, making them highly testable via Vitest.

```typescript
export type ProjectNature = 'FULL_STACK_PAIR' | 'API_ONLY';

export interface TopologyContext {
  nature: ProjectNature;
  monorepoRoot: string;
  currentPackageName: string;
  siblingPackageName?: string;
}

/**
 * Traverses upwards to locate the root 'backstage.json' anchor file.
 */
export function findMonorepoRoot(startDir: string): string;

/**
 * Parses the local package.json file alongside the global workspace configuration
 * to extract the Backstage plugin metadata role and evaluate architecture context.
 */
export function determineTopology(currentDir: string): TopologyContext;
```

##### Detailed Heuristic Execution Track:

1. Locates the root workspace using `findMonorepoRoot`.
2. Inspects the current directory's `package.json` for `backstage.role`.
3. If the role is `backend-plugin`, it strips the `-backend` suffix from the package name, appends `-frontend`, and scans the monorepo workspace tree to check if that package definition is active.
4. If a valid sibling frontend plugin is found, it returns `FULL_STACK_PAIR`. Otherwise, it falls back gracefully to `API_ONLY`.

#### Part B: OCI Layer Retrieval Subsystem (`lib/oci.ts`)

Instead of spawning fragile shell string variations of `docker manifest`, this engine utilizes `oras-js` to download the specific YAML configuration programmatically.

```typescript
import { OciRegistryClient } from 'oras-js'; // Representative import of ORAS API interface

export interface OciFetchOptions {
  registryUrl: string;
  artifactTag: string;
  destinationPath: string;
}

/**
 * Establishes an unauthenticated or token-injected channel to the target OCI registry,
 * pulls the target layout layer, and writes it directly to the local disk.
 */
export async function fetchComposeArtifact(options: OciFetchOptions): Promise<void>;
```

##### Core Logic Considerations:

- Configures automatic handling for localhost configurations (`localhost:32443`) by checking for port indicators and bypassing TLS verification flags dynamically if insecure flags are required.
- Ensures the directory path `/tmp/workbench-compose/` is programmatically initialized (`fs.mkdirSync(..., { recursive: true })`) before downloading layers.

#### Part C: Docker Compose Cluster Engine (`lib/cluster.ts`)

This class provides a strict TypeScript boundary layer around the standard `child_process` subsystem, formatting options accurately to bridge the temporary folder gap.

```typescript
export interface ClusterOptions {
  composeFile: string;
  projectDirectory: string; // The consumer repo's root directory context
}

export class ComposeClusterController {
  constructor(private options: ClusterOptions) {}

  /**
   * Spawns: docker compose -f /tmp/workbench-compose/compose.yaml --project-directory <cwd> up -d --wait
   */
  async up(): Promise<void>;

  /**
   * Spawns: docker compose -f /tmp/workbench-compose/compose.yaml --project-directory <cwd> down
   */
  async down(): Promise<void>;
}
```

##### Lifecycle Safeguards:

- Utilizing the native `--wait` parameter shifts the entire burden of checking database readiness, service availability, and health metrics directly onto the platform team's hardened internal `Dockerfile` setups.
- Control is only returned to the next execution chain block once the command exits cleanly with status code `0`.

#### Part D: Node Process Stream Management (`lib/runner.ts`)

This module handles orchestration of long-running development applications using concurrent non-blocking execution layers.

```typescript
/**
 * Spawns a long-running Node script thread, hooks into host terminal IO streams,
 * and tracks the log payload buffer output until a target port responds to a health check.
 */
export function spawnDevServer(command: string, args: string[], options: { cwd: string; readyPort?: number }): Promise<ChildProcess>;
```

##### The Orchestration Flow:

1. Spawns the Backstage Backend server script using `spawn('yarn', ['start:backend'])`.
2. Initiates a short, lightweight polling loop checking the native health endpoint on port `7007`.
3. Once `7007` responds with a valid payload, the promise resolves.
4. If `FULL_STACK_PAIR` is active, it immediately triggers the next sequential process block to start the Frontend server on port `3000`.

### 4. Main Command Pipeline Execution Sequence

`compose:start` Sequence Diagram

```text
[Developer Executing CLI]
        │
        ▼
 1. Execute determineTopology() ───> Detects Nature (e.g., FULL_STACK_PAIR)
        │
        ▼
 2. Execute fetchComposeArtifact() ─> Pulls remote manifest to /tmp/workbench-compose/
        │
        ▼
 3. Execute cluster.up() ──────────> Calls `up -d --wait` (Blocks until all healthy)
        │
        ▼
 4. Execute spawnDevServer() ──────> Launches Backend -> Waits for Port 7007
        │
        ▼
 5. Execute spawnDevServer() ──────> Launches Frontend on Port 3000
        │
        ▼
 6. Bind Intercept Signals ────────> Listens for SIGINT / SIGTERM
        │
        ▼
 [User Hits Ctrl+C] ───────────────> Kills Node Child Processes -> Calls cluster.down()
```

### 5. Teardown Blueprint (`compose-stop/index.ts`)

The stop command uses a fast path execution sequence. It does not look up local repository details or verify `package.json` configurations. Its only goal is resource cleanup.

Execution Track:

1. Checks for the existence of the file cache target `/tmp/workbench-compose/compose.yaml`.

2. Resolves the consumer's current working directory context.

3. Instantiates `ComposeClusterController` targeting the asset cache.

4. Spawns the clean teardown command:

   ```bash
   docker compose -f /tmp/workbench-compose/compose.yaml --project-directory <cwd> down
   ```

#### Comprehensive Test Specifications Template

Test Suite: Nature Detection (`__tests__/topology.spec.ts`)

This unit test file uses virtual directory structures to ensure the nature processor acts deterministically across edge-case variations:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { determineTopology } from '../lib/topology';

describe('Monorepo Package Nature Evaluation Suite', () => {
  it('should identify API_ONLY nature when package.json represents an isolated driver framework', () => {
    // Mock package.json with backstage.role = 'backend-plugin' but no sibling structures
    // Assert determineTopology yields 'API_ONLY'
  });

  it('should identify FULL_STACK_PAIR nature when matching backend and frontend configuration keys coexist', () => {
    // Mock workspace tree structure with both backend-plugin and frontend-plugin configurations
    // Assert determineTopology yields 'FULL_STACK_PAIR'
  });
});
```

## Design Extension: Lifecycle Governance & Configuration Propagation

### 1. Terminal Signal Handling Rules (Orphan Prevention)

When running multiple long-running child processes (Docker clusters, Node backends, and Node frontends), a naive termination cleanly shuts down the parent CLI but leaves the background processes active as "orphans."

To enforce an **atomic teardown sequence** when a developer triggers `Ctrl+C` (`SIGINT`), closes the terminal pane (`SIGHUP`), or the orchestration engine finishes execution (`SIGTERM`), the orchestrator registers a centralized tracking array and lifecycle hooks.

#### State Tracking Registry

```typescript
interface ProcessRegistry {
  backendProcess: ChildProcess | null;
  frontendProcess: ChildProcess | null;
  isCleaningUp: boolean;
}

const activeStack: ProcessRegistry = {
  backendProcess: null,
  frontendProcess: null,
  isCleaningUp: false,
};
```

#### The Atomic Cleanup Sequence

The cleanup sequence uses a non-rentrant gate (`isCleaningUp`) to prevent recursive execution loops if multiple signals fire at once:

```text
[Signal Triggered: SIGINT/SIGTERM/SIGHUP]
                  │
                  ▼
       Check: isCleaningUp === true? ───> Yes ───> [Exit immediately]
                  │
                  ▼ No
         Set: isCleaningUp = true
                  │
                  ▼
 1. Kill Frontend Node Process ───> send SIGTERM ───> Wait for close
                  │
                  ▼
 2. Kill Backend Node Process ────> send SIGTERM ───> Wait for close
                  │
                  ▼
 3. Execute Cluster Down ─────────> `docker compose down` (Blocks until complete)
                  │
                  ▼
 4. Exit Main Process ────────────> process.exit(0)
```

#### Signal Listener Implementation Spec

```typescript
function registerSignalHandlers(clusterController: ComposeClusterController) {
  const handleTeardown = async (signal: string) => {
    if (activeStack.isCleaningUp) return;
    activeStack.isCleaningUp = true;

    console.log(`\n🛑 [CLI] ${signal} intercepted. Initiating graceful environment evacuation...`);

    // 1. Terminate Frontend Node Engine
    if (activeStack.frontendProcess) {
      activeStack.frontendProcess.kill('SIGTERM');
    }

    // 2. Terminate Backend Node Engine
    if (activeStack.backendProcess) {
      activeStack.backendProcess.kill('SIGTERM');
    }

    // 3. Destruct the Docker Infrastructure Layer Completely
    try {
      console.log('🧹 [CLI] Stopping background Docker infrastructure container matrix...');
      await clusterController.down();
    } catch (error) {
      console.error('❌ [CLI] Critical failure occurred during infrastructure down sequence:', error);
    }

    console.log('✅ [CLI] System cleanup finished successfully. Exiting tracking context.');
    process.exit(0);
  };

  // Bind to all standard POSIX termination pathways
  process.on('SIGINT', () => handleTeardown('SIGINT'));
  process.on('SIGTERM', () => handleTeardown('SIGTERM'));
  process.on('SIGHUP', () => handleTeardown('SIGHUP'));
}
```

### 2. Process Environment Variable Propagation Matrix

The Backstage child processes cannot function cleanly without inheriting environment context from the host. However, passing the *entire* raw dictionary array (`process.env`) introduces high security risks (leaking credentials, tokens, and SSH paths into standard log streams) and can cause configuration conflicts.

To prevent this, the CLI implements an **Explicit Opt-in Inheritance Filter Matrix**.

#### Environment Classification Layer

```text
[Host Machine System Context] 
        │
        ├── Isolate Security Tokens ──> Injected into App Config
        ├── Isolate Workspace Paths ──> Used to map network binds
        └── Filter Base Config Array ──> Merged into Child Envs
```

#### The Merging Heuristic Matrix

When `spawnDevServer` is called, the CLI builds an explicit environment configuration context payload:

| Variable Identifier | Source Context | Functional Target Destination |
| --- | --- | --- |
| `PATH` | Host Machine Shell | Mandatory for Node, Yarn, and binary cross-resolution workflows. |
| `NODE_ENV` | Host / Defaulting | Forces standard `'development'` flags across engines. |
| `REGISTRY` | Host Machine Env | Directs downstream configurations where to resolve artifact layers. |
| `BACKSTAGE_APP_URL` | Derived Variable | Explicitly overridden to match port configurations (`http://localhost:3000`). |
| `BACKSTAGE_API_URL` | Derived Variable | Explicitly overridden to point back to the backend node (`http://localhost:7007`). |

### Code Design Blueprint

```typescript
export function computeChildEnvironment(topology: TopologyContext): Record<string, string> {
  const baselineEnv: Record<string, string> = {
    // 1. Inherit core system context execution parameters safely
    PATH: process.env.PATH || '',
    HOME: process.env.HOME || '',
    NODE_ENV: process.env.NODE_ENV || 'development',
    
    // 2. Forward target registry configurations
    REGISTRY: process.env.REGISTRY || 'ghcr.io/ai-crew-suite',
    
    // 3. Inject deterministic service routing discovery hooks
    BACKSTAGE_ROLE: topology.nature,
    MONOREPO_ROOT_PATH: topology.monorepoRoot,
  };

  // 4. Safely scrape any platform-specific prefixed variables (e.g., AI_CREW_*)
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('AI_CREW_') && value !== undefined) {
      baselineEnv[key] = value;
    }
  }

  return baselineEnv;
}
```

This ensures that the child process receives precisely the infrastructure layout parameters it needs to bootstrap its communication paths without cluttering the logging framework or risking supply chain exposure.

