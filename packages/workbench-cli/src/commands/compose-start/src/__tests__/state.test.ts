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
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { isSameProcess, processIdentity, terminateProcessTree } from '../processes';
import { LifecycleStore } from '../state';

describe('lifecycle safety', () => {
  let root: string | undefined;
  let directory: string | undefined;

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it('rejects invalid state instead of acting on stored PIDs', async () => {
    root = await mkdtemp(join(tmpdir(), 'workbench-state-test-'));
    const store = await LifecycleStore.create(root);
    directory = store.directory;
    await writeFile(join(directory, 'workbench.pid'), JSON.stringify({
      version: 1, root: '/different-repository', composeFile: store.composeFile,
      projectName: store.projectName, reference: 'example', phase: 'running',
      servers: { app: { child: { pid: process.pid, started: 'invalid' } } },
    }));
    await expect(store.read()).rejects.toThrow('Invalid workbench lifecycle state');
  });

  it('does not signal a PID when its recorded creation time differs', () => {
    const current = processIdentity(process.pid);
    expect(current).toBeDefined();
    const stale = { pid: process.pid, started: `${current!.started}-stale` };
    expect(isSameProcess(stale)).toBe(false);
    expect(() => terminateProcessTree(stale)).not.toThrow();
    expect(isSameProcess(current!)).toBe(true);
    expect(() => terminateProcessTree(current!)).toThrow('Refusing to terminate');
  });
});
