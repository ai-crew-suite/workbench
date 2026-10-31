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
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { findRepoRoot } from '../../../utils/workspace';
import { resolveTargetTags } from '../../../utils/oci';
import { ComposeClusterController } from './cluster';
import { fetchComposeArtifact, registryTransport } from './oci';
import { isSameProcess, processIdentity, terminateProcessTree } from './processes';
import { LifecycleStore, type LifecycleState, type ServerKind, type ServerRecord } from './state';

/** Options for starting one consumer development server. */
export interface StartOptions {
  target: ServerKind;
  registry: string;
  tag: string;
  plainHttp?: boolean;
}

async function validateWorkspace(root: string, target: ServerKind): Promise<string> {
  if (!existsSync(join(root, 'backstage.json'))) {
    throw new Error('Run this command inside a Backstage repository containing backstage.json.');
  }
  const directory = join(root, 'packages', target);
  const manifest: unknown = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  if (typeof manifest !== 'object' || manifest === null || !('scripts' in manifest)
    || typeof manifest.scripts !== 'object' || manifest.scripts === null
    || !('start:dev' in manifest.scripts) || typeof manifest.scripts['start:dev'] !== 'string'
    || !manifest.scripts['start:dev']) {
    throw new Error(`${directory} must define a start:dev script for the underlying dev server.`);
  }
  return directory;
}

function spawnServer(directory: string): ChildProcess {
  if (process.platform === 'win32') {
    return spawn(process.env['ComSpec'] || 'cmd.exe', ['/d', '/s', '/c', 'yarn.cmd run start:dev'], {
      cwd: directory, stdio: 'inherit', env: process.env, windowsHide: true,
    });
  }
  return spawn('yarn', ['run', 'start:dev'], { cwd: directory, stdio: 'inherit', env: process.env });
}

function sameIdentity(left: ServerRecord, right: ServerRecord): boolean {
  return left.supervisor.pid === right.supervisor.pid && left.supervisor.started === right.supervisor.started;
}

/**
 * Starts one foreground server after ensuring its repository's Compose stack is
 * healthy. The shared stack remains running until an explicit stop.
 */
export async function startCompose(options: StartOptions): Promise<void> {
  const root = findRepoRoot();
  const directory = await validateWorkspace(root, options.target);
  const store = await LifecycleStore.create(root);
  const reference = resolveTargetTags('compose', options.registry, options.tag).remoteTargetTag;
  const transport = registryTransport(options.registry, options.plainHttp);
  const cluster = new ComposeClusterController({
    composeFile: store.composeFile, projectDirectory: store.root, projectName: store.projectName,
  });

  const { child, record, closed } = await store.locked(async () => {
    let state = await store.read();
    if (state?.phase === 'stopping') throw new Error('Compose teardown is in progress; retry after it completes.');
    if (state && (state.reference !== reference || state.transport !== transport)) {
      throw new Error(`The active stack uses ${state.transport}://${state.reference}; stop it before changing the artifact or transport.`);
    }
    const existing = state?.servers[options.target];
    if (existing && (isSameProcess(existing.supervisor) || isSameProcess(existing.child))) {
      throw new Error(`The ${options.target} server is already running or needs cleanup; use compose stop first.`);
    }
    if (existing && state) delete state.servers[options.target];

    if (!state) {
      await fetchComposeArtifact({
        registry: options.registry, tag: options.tag, destinationPath: store.composeFile, plainHttp: options.plainHttp,
      });
      state = {
        version: 1, root: store.root, composeFile: store.composeFile, projectName: store.projectName,
        reference, transport, phase: 'starting', servers: {},
      };
      await store.write(state);
    }
    await cluster.up();
    state.phase = 'running';
    await store.write(state);

    const supervisor = processIdentity(process.pid);
    if (!supervisor) throw new Error('Cannot identify the current CLI process.');
    const spawnedChild = spawnServer(directory);
    const childClosed = new Promise<{ code: number | null; signal: NodeJS.Signals | null; error?: Error }>(resolve => {
      spawnedChild.once('error', error => resolve({ code: null, signal: null, error }));
      spawnedChild.once('close', (code, signal) => resolve({ code, signal }));
    });
    await new Promise<void>((resolve, reject) => {
      spawnedChild.once('spawn', resolve);
      spawnedChild.once('error', reject);
    });
    let identity;
    try {
      identity = spawnedChild.pid && processIdentity(spawnedChild.pid);
    } catch (error) {
      spawnedChild.kill('SIGTERM');
      await childClosed;
      throw error;
    }
    if (!identity) {
      spawnedChild.kill('SIGTERM');
      await childClosed;
      throw new Error(`The ${options.target} dev server exited before its process could be tracked.`);
    }
    const serverRecord = { supervisor, child: identity };
    state.servers[options.target] = serverRecord;
    try {
      await store.write(state);
    } catch (error) {
      terminateProcessTree(identity);
      throw error;
    }
    return { child: spawnedChild, record: serverRecord, closed: childClosed };
  });

  let interrupted = false;
  let signalFailure: unknown;
  const handleSignal = () => {
    if (interrupted) return;
    interrupted = true;
    try {
      terminateProcessTree(record.child);
    } catch (error) {
      signalFailure = error;
      console.error(`Failed to terminate the ${options.target} dev server:`, error);
    }
  };
  process.on('SIGINT', handleSignal);
  process.on('SIGTERM', handleSignal);
  if (process.platform !== 'win32') process.on('SIGHUP', handleSignal);
  try {
    const result = await closed;
    if (result.error) throw new Error(`Failed to start ${options.target} dev server.`, { cause: result.error });
    if (signalFailure) throw signalFailure;
    if (!interrupted && result.code !== 0) {
      throw new Error(`${options.target} dev server exited${result.signal ? ` with signal ${result.signal}` : ` with status ${result.code}`}.`);
    }
  } finally {
    process.off('SIGINT', handleSignal);
    process.off('SIGTERM', handleSignal);
    if (process.platform !== 'win32') process.off('SIGHUP', handleSignal);
    await store.locked(async () => {
      const current: LifecycleState | undefined = await store.read();
      const active = current?.servers[options.target];
      if (current && active && sameIdentity(active, record)) {
        delete current.servers[options.target];
        await store.write(current);
      }
    });
    child.unref();
  }
}
