/**
 * Copyright 2026 The AI Crew Suite Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import lockfile from 'proper-lockfile';
import type { ProcessIdentity } from './processes';

/** The two supported consumer development servers. */
export type ServerKind = 'app' | 'backend';

/** The supervisor and server process identities persisted for safe shutdown. */
export interface ServerRecord {
  supervisor: ProcessIdentity;
  child: ProcessIdentity;
}

/** Persistent state for the isolated Compose project. */
export interface LifecycleState {
  version: 1;
  root: string;
  composeFile: string;
  projectName: string;
  reference: string;
  transport: 'http' | 'https';
  phase: 'starting' | 'running' | 'stopping';
  servers: Partial<Record<ServerKind, ServerRecord>>;
}

function isIdentity(value: unknown): value is ProcessIdentity {
  if (typeof value !== 'object' || value === null || !('pid' in value) || !('started' in value)) return false;
  return typeof value.pid === 'number' && Number.isSafeInteger(value.pid) && value.pid > 1
    && typeof value.started === 'string' && value.started.length > 0;
}

function isServerRecord(value: unknown): value is ServerRecord {
  return typeof value === 'object' && value !== null && 'supervisor' in value && 'child' in value
    && isIdentity(value.supervisor) && isIdentity(value.child);
}

/** Provides locked, atomic access to one repository's fixed-name PID file. */
export class LifecycleStore {
  private constructor(
    readonly root: string,
    readonly directory: string,
    readonly composeFile: string,
    readonly projectName: string,
  ) {}

  /** Resolves a canonical repository-specific private temporary directory. */
  static async create(root: string): Promise<LifecycleStore> {
    const canonicalRoot = await realpath(root);
    const hash = createHash('sha256').update(homedir()).update('\0').update(canonicalRoot).digest('hex').slice(0, 20);
    const directory = join(tmpdir(), `workbench-compose-${hash}`);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink()
      || (process.platform !== 'win32' && ((info.mode & 0o077) !== 0 || info.uid !== process.getuid?.()))) {
      throw new Error(`Unsafe workbench state directory: ${directory}`);
    }
    return new LifecycleStore(canonicalRoot, directory, join(directory, 'compose.yml'), `workbench-${hash.slice(0, 12)}`);
  }

  /** Serializes startup and shutdown across separate CLI invocations. */
  async locked<T>(operation: () => Promise<T>): Promise<T> {
    const release = await lockfile.lock(this.directory, {
      stale: 120000,
      update: 10000,
      retries: { retries: 300, minTimeout: 500, maxTimeout: 500, factor: 1 },
    });
    try {
      return await operation();
    } finally {
      await release();
    }
  }

  /** Reads and validates state before using any stored process identities. */
  async read(): Promise<LifecycleState | undefined> {
    let text: string;
    try {
      text = await readFile(join(this.directory, 'workbench.pid'), 'utf8');
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
      throw error;
    }
    const value: unknown = JSON.parse(text);
    if (typeof value !== 'object' || value === null
      || !('version' in value) || value.version !== 1
      || !('root' in value) || value.root !== this.root
      || !('composeFile' in value) || value.composeFile !== this.composeFile
      || !('projectName' in value) || value.projectName !== this.projectName
      || !('reference' in value) || typeof value.reference !== 'string'
      || !('transport' in value) || !['http', 'https'].includes(String(value.transport))
      || !('phase' in value) || !['starting', 'running', 'stopping'].includes(String(value.phase))
      || !('servers' in value) || typeof value.servers !== 'object' || value.servers === null
      || Object.entries(value.servers).some(([kind, record]) =>
        !['app', 'backend'].includes(kind) || !isServerRecord(record))) {
      throw new Error(`Invalid workbench lifecycle state in ${this.directory}; refusing to manage processes.`);
    }
    return value as LifecycleState;
  }

  /** Atomically records lifecycle state without persisting credentials. */
  async write(state: LifecycleState): Promise<void> {
    const temporary = join(this.directory, `state-${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, JSON.stringify(state, null, 2), { mode: 0o600, flag: 'wx' });
      await rename(temporary, join(this.directory, 'workbench.pid'));
    } finally {
      await rm(temporary, { force: true });
    }
  }

  /** Removes the state file after a successful teardown. */
  async clear(): Promise<void> {
    await rm(join(this.directory, 'workbench.pid'), { force: true });
  }
}
