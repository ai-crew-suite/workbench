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
import { readImageReceipt, structureConfigDigest, writeImageReceipt } from '../../../../utils/oci/image-receipt';
import { runImagePromote } from '../promote';

const mocks = vi.hoisted(() => ({ digest: vi.fn(), promote: vi.fn() }));
vi.mock('../../../../utils/oci/image-registry', () => ({
  ImageRegistry: class {
    digest = mocks.digest;
    promote = mocks.promote;
  },
}));

describe('manual image promotion', () => {
  const imageId = `sha256:${'a'.repeat(64)}`;
  const digest = `sha256:${'b'.repeat(64)}`;
  const registry = 'localhost:32443/team';
  const reference = `${registry}/example@${digest}`;
  let root: string;
  let dir: string;
  beforeEach(() => {
    vi.resetAllMocks();
    root = mkdtempSync(join(tmpdir(), 'image-promote-test-'));
    dir = join(root, 'packages/example');
    mkdirSync(join(dir, '__tests__'), { recursive: true });
    writeFileSync(join(root, 'backstage.json'), '{}');
    writeFileSync(join(dir, 'Dockerfile'), 'FROM scratch');
    const config = join(dir, '__tests__/example.cst.yaml');
    writeFileSync(config, 'schemaVersion: "2.0.0"');
    writeImageReceipt(dir, {
      version: 1, target: 'example', imageId, localTag: `local/example:sha256-${'a'.repeat(64)}`,
      platform: 'linux/amd64', structureTest: { imageId, configDigest: structureConfigDigest(config) },
      publications: { [registry]: reference },
      publicationTests: { [registry]: { reference, configDigest: structureConfigDigest(config) } },
    });
    vi.spyOn(process, 'cwd').mockReturnValue(root);
    mocks.digest.mockReturnValue(digest);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  it('promotes the published digest to latest without Docker or a rebuild', async () => {
    await runImagePromote({ target: 'example', registry, tag: 'latest' });
    expect(mocks.promote).toHaveBeenCalledWith(reference, 'latest');
    expect(mocks.digest).toHaveBeenCalledWith(`${registry}/example:latest`);
  });

  it('does not promote if the test configuration changed', async () => {
    writeFileSync(join(dir, '__tests__/example.cst.yaml'), 'changed');
    await expect(runImagePromote({ target: 'example', registry, tag: 'latest' })).rejects.toThrow('no passing structure test');
    expect(mocks.promote).not.toHaveBeenCalled();
  });

  it('rejects a channel that resolves to a different digest', async () => {
    mocks.digest.mockReturnValueOnce(digest).mockReturnValueOnce(`sha256:${'c'.repeat(64)}`);
    await expect(runImagePromote({ target: 'example', registry, tag: 'latest' })).rejects.toThrow('Promotion verification failed');
  });

  it('does not allow candidate identity tags to be used as channels', async () => {
    await expect(runImagePromote({ target: 'example', registry, tag: `sha256-${'a'.repeat(64)}` })).rejects.toThrow('cannot be used');
  });

  it('rejects a published digest without digest-specific test evidence', async () => {
    const receipt = readImageReceipt(dir, 'example');
    delete receipt.publicationTests;
    writeImageReceipt(dir, receipt);
    await expect(runImagePromote({ target: 'example', registry, tag: 'latest' })).rejects.toThrow('has not passed');
    expect(mocks.promote).not.toHaveBeenCalled();
  });
});
