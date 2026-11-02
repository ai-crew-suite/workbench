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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readImageReceipt, writeImageReceipt } from '../../../../utils/oci/image-receipt';
import { runStructureTests } from '../test-structure';

const mocks = vi.hoisted(() => ({ spawn: vi.fn(), run: vi.fn(), inspect: vi.fn() }));
vi.mock('node:child_process', () => ({ spawnSync: mocks.spawn }));
vi.mock('../../../../utils/run-process', () => ({ runProcess: mocks.run }));
vi.mock('dockerode', () => ({
  default: class {
    getImage() { return { inspect: mocks.inspect }; }
  },
}));

describe('structure-test evidence', () => {
  const imageId = `sha256:${'a'.repeat(64)}`;
  let root: string;
  let targetDir: string;
  beforeEach(() => {
    vi.resetAllMocks();
    root = mkdtempSync(join(tmpdir(), 'image-structure-test-'));
    targetDir = join(root, 'packages/example');
    mkdirSync(join(targetDir, '__tests__'), { recursive: true });
    writeFileSync(join(root, 'backstage.json'), '{}');
    writeFileSync(join(targetDir, 'Dockerfile'), 'FROM scratch');
    writeFileSync(join(targetDir, '__tests__/example.cst.yaml'), 'schemaVersion: "2.0.0"');
    writeImageReceipt(targetDir, {
      version: 1, target: 'example', imageId, localTag: `local/example:sha256-${'a'.repeat(64)}`,
      platform: 'linux/amd64', publications: {},
    });
    vi.spyOn(process, 'cwd').mockReturnValue(root);
    mocks.inspect.mockResolvedValue({ Id: imageId });
    mocks.spawn.mockReturnValue({ status: 0 });
    mocks.run.mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  it('tests the image ID and records evidence for that image', async () => {
    await runStructureTests({ target: 'example' });
    expect(mocks.run).toHaveBeenCalledWith('container-structure-test',
      expect.arrayContaining(['--image', imageId]));
    expect(readImageReceipt(targetDir, 'example').structureTest?.imageId).toBe(imageId);
  });

  it('clears prior evidence when a re-test fails', async () => {
    await runStructureTests({ target: 'example' });
    mocks.run.mockRejectedValueOnce(new Error('structure test failed'));
    await expect(runStructureTests({ target: 'example' })).rejects.toThrow('structure test failed');
    expect(readImageReceipt(targetDir, 'example').structureTest).toBeUndefined();
  });

  it('rejects a missing test configuration', async () => {
    rmSync(join(targetDir, '__tests__/example.cst.yaml'));
    await expect(runStructureTests({ target: 'example' })).rejects.toThrow('exactly one structure test');
  });
});
