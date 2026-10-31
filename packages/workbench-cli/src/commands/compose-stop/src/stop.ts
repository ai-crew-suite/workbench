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
import { existsSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { join } from 'node:path';
import { findRepoRoot } from '../../../utils/workspace';
import { ComposeClusterController } from '../../compose-start/src/cluster';
import { isSameProcess, terminateProcessTree } from '../../compose-start/src/processes';
import { LifecycleStore, type ServerRecord } from '../../compose-start/src/state';

async function waitForServers(records: ServerRecord[]): Promise<boolean> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (records.every(record => !isSameProcess(record.supervisor) && !isSameProcess(record.child))) return true;
    await delay(100);
  }
  return false;
}

/** Stops only the tracked dev servers and the current repository's Compose project. */
export async function stopCompose(): Promise<void> {
  const root = findRepoRoot();
  if (!existsSync(join(root, 'backstage.json'))) {
    throw new Error('Run this command inside a Backstage repository containing backstage.json.');
  }
  const store = await LifecycleStore.create(root);
  const records = await store.locked(async () => {
    const state = await store.read();
    if (!state) return undefined;
    state.phase = 'stopping';
    await store.write(state);
    return Object.values(state.servers);
  });
  if (!records) {
    console.log('No managed Compose stack is recorded for this repository.');
    return;
  }

  for (const record of records) {
    terminateProcessTree(record.supervisor);
    terminateProcessTree(record.child);
  }
  if (!await waitForServers(records)) {
    for (const record of records) {
      terminateProcessTree(record.supervisor, 'SIGKILL');
      terminateProcessTree(record.child, 'SIGKILL');
    }
    if (!await waitForServers(records)) {
      throw new Error('Some managed dev server processes could not be stopped; Compose remains running.');
    }
  }

  await store.locked(async () => {
    const current = await store.read();
    if (!current) return;
    if (current.phase !== 'stopping') throw new Error('Compose lifecycle state changed during teardown.');
    const active = Object.values(current.servers);
    if (active.some(record => isSameProcess(record.supervisor) || isSameProcess(record.child))) {
      throw new Error('A managed dev server is still running; Compose remains running.');
    }
    const cluster = new ComposeClusterController({
      composeFile: store.composeFile, projectDirectory: store.root, projectName: store.projectName,
    });
    await cluster.down();
    await store.clear();
  });
}
