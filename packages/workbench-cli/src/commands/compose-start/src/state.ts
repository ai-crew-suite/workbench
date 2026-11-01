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
import { userInfo } from 'node:os';
import { basename, isAbsolute, join } from 'node:path';
import lockfile from 'proper-lockfile';

/** Persistent state for the user's shared Compose stack. */
export interface LifecycleState {
  version: 2;
  root: string;
  repository: string;
  composeFile: string;
  projectName: string;
  daemonId: string;
  reference: string;
  transport: 'http' | 'https';
  phase: 'starting' | 'running' | 'stopping';
}

/** Provides locked, atomic access to the user's shared Compose state. */
export class LifecycleStore {
  private constructor(
    readonly root: string,
    readonly directory: string,
    readonly composeFile: string,
    readonly projectName: string,
  ) {}

  /** Resolves a private state directory shared by all of the user's repositories. */
  static async create(root: string): Promise<LifecycleStore> {
    const canonicalRoot = await realpath(root);
    const home = userInfo().homedir;
    const hash = createHash('sha256').update(home).digest('hex').slice(0, 20);
    const directory = join(home, '.workbench-compose');
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink()
      || (process.platform !== 'win32' && ((info.mode & 0o077) !== 0 || info.uid !== process.getuid?.()))) {
      throw new Error(`Unsafe workbench state directory: ${directory}`);
    }
    return new LifecycleStore(canonicalRoot, directory, join(directory, 'compose.yml'), `workbench-shared-${hash.slice(0, 12)}`);
  }

  /** Serializes startup and shutdown across repositories. */
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

  /** Reads and validates the shared state without assuming the caller owns it. */
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
      || !('version' in value) || value.version !== 2
      || !('root' in value) || typeof value.root !== 'string' || !isAbsolute(value.root)
      || !('repository' in value) || value.repository !== basename(value.root)
      || !('composeFile' in value) || value.composeFile !== this.composeFile
      || !('projectName' in value) || value.projectName !== this.projectName
      || !('daemonId' in value) || typeof value.daemonId !== 'string' || !value.daemonId
      || !('reference' in value) || typeof value.reference !== 'string' || !value.reference
      || !('transport' in value) || !['http', 'https'].includes(String(value.transport))
      || !('phase' in value) || !['starting', 'running', 'stopping'].includes(String(value.phase))) {
      throw new Error(`Invalid workbench lifecycle state in ${this.directory}; refusing to manage the stack.`);
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
