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
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { userInfo } from 'node:os';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { promisify } from 'node:util';
import lockfile from 'proper-lockfile';
import type { LifecycleStore } from './state';

const execFileAsync = promisify(execFile);

/** A previously managed repository-scoped Compose project. */
export interface LegacyStack {
  root: string;
  repository: string;
  composeFile: string;
  projectName: string;
  stateFile: string;
}

/** Coordinates teardown with an older repository-scoped launcher. */
export async function withLegacyStackLock<T>(stack: LegacyStack, operation: () => Promise<T>): Promise<T> {
  const release = await lockfile.lock(dirname(stack.stateFile), {
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

/** Finds existing shared and previous repository-scoped projects. */
export async function inspectExistingStacks(store: LifecycleStore): Promise<{
  sharedExists: boolean;
  daemonId: string;
  legacy: LegacyStack[];
}> {
  const daemon = await execFileAsync('docker', ['info', '--format', '{{.ID}}']);
  const daemonId = daemon.stdout.trim();
  if (!daemonId) throw new Error('Docker did not provide a daemon identity.');
  const { stdout } = await execFileAsync('docker', ['compose', 'ls', '--all', '--format', 'json']);
  const projects: unknown = JSON.parse(stdout);
  if (!Array.isArray(projects)) throw new Error('Docker Compose returned an invalid project list.');
  const legacy: LegacyStack[] = [];
  let sharedExists = false;
  for (const project of projects) {
    if (typeof project !== 'object' || project === null
      || typeof project.Name !== 'string' || typeof project.ConfigFiles !== 'string') {
      throw new Error('Docker Compose returned an invalid project entry.');
    }
    if (project.Name === store.projectName) sharedExists = true;
    if (!/^workbench-[a-f0-9]{12}$/.test(project.Name)) continue;
    const configFiles = project.ConfigFiles.split(',');
    const composeFile = configFiles.find((file: string) => {
      const directory = dirname(file);
      return isAbsolute(directory) && /^workbench-compose-[a-f0-9]{20}$/.test(basename(directory))
        && file === join(directory, 'compose.yml');
    });
    if (!composeFile) continue;
    const directory = dirname(composeFile);
    let info;
    try {
      info = await lstat(directory);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new Error(`Previous workbench project ${project.Name} has lost its state directory; stop it manually before continuing.`);
      }
      throw error;
    }
    if (process.platform !== 'win32' && info.uid !== process.getuid?.()) continue;
    if (!info.isDirectory() || info.isSymbolicLink() || (process.platform !== 'win32' && (info.mode & 0o077) !== 0)) {
      throw new Error(`Unsafe previous workbench state directory: ${directory}`);
    }
    const stateFile = join(directory, 'workbench.pid');
    let value: unknown;
    try {
      value = JSON.parse(await readFile(stateFile, 'utf8'));
    } catch (error) {
      throw new Error(`Cannot read previous workbench state for ${project.Name}; stop it manually before continuing.`, { cause: error });
    }
    if (typeof value !== 'object' || value === null || !('version' in value) || value.version !== 1
      || !('root' in value) || typeof value.root !== 'string' || !isAbsolute(value.root)
      || !('composeFile' in value) || value.composeFile !== composeFile
      || !('projectName' in value) || value.projectName !== project.Name) {
      throw new Error(`Invalid previous workbench state for ${project.Name}; stop it manually before continuing.`);
    }
    const hash = createHash('sha256').update(userInfo().homedir).update('\0').update(value.root).digest('hex').slice(0, 20);
    if (basename(directory) !== `workbench-compose-${hash}` || project.Name !== `workbench-${hash.slice(0, 12)}`) {
      throw new Error(`Previous workbench project ${project.Name} does not match its recorded owner.`);
    }
    legacy.push({ root: value.root, repository: basename(value.root), composeFile, projectName: project.Name, stateFile });
  }
  return { sharedExists, daemonId, legacy };
}
