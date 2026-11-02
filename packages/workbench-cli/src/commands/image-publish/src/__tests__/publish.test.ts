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
import { ImagePublisher } from '../publish';
import type { DockerService } from '../docker-service';
import { readImageReceipt, structureConfigDigest, writeImageReceipt } from '../../../../utils/oci/image-receipt';

const mocks = vi.hoisted(() => ({ digest: vi.fn(), imageConfigDigest: vi.fn(), testImageStructure: vi.fn() }));
vi.mock('../../../../utils/oci/image-registry', () => ({
  ImageRegistry: class {
    digest = mocks.digest;
    imageConfigDigest = mocks.imageConfigDigest;
  },
}));
vi.mock('../../../image-test-structure/src/test-structure', () => ({
  testImageStructure: mocks.testImageStructure,
}));
vi.mock('../../../../utils/workspace', async importOriginal => ({
  ...await importOriginal<typeof import('../../../../utils/workspace')>(),
  hasBinary: () => false,
}));

describe('image candidate publication', () => {
  const imageId = `sha256:${'a'.repeat(64)}`;
  const digest = `sha256:${'b'.repeat(64)}`;
  const registry = 'localhost:32443/team';
  const candidate = `${registry}/grafana-container:sha256-${'a'.repeat(64)}`;
  let dir: string;
  let docker: {
    requireImage: ReturnType<typeof vi.fn>;
    prepareAlias: ReturnType<typeof vi.fn>;
    pushImage: ReturnType<typeof vi.fn>;
    removeAlias: ReturnType<typeof vi.fn>;
    pullDigest: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    dir = mkdtempSync(join(tmpdir(), 'image-publish-test-'));
    mkdirSync(join(dir, '__tests__'));
    const config = join(dir, '__tests__/grafana.cst.yaml');
    writeFileSync(config, 'schemaVersion: "2.0.0"\n');
    writeImageReceipt(dir, {
      version: 1, target: 'grafana-container', imageId,
      localTag: `local/grafana-container:sha256-${'a'.repeat(64)}`,
      platform: 'linux/amd64', structureTest: { imageId, configDigest: structureConfigDigest(config) },
      publications: {},
    });
    docker = {
      requireImage: vi.fn().mockResolvedValue(undefined),
      prepareAlias: vi.fn().mockResolvedValue(true),
      pushImage: vi.fn().mockResolvedValue(`${registry}/grafana-container@${digest}`),
      removeAlias: vi.fn().mockResolvedValue(undefined),
      pullDigest: vi.fn().mockResolvedValue(false),
    };
    mocks.imageConfigDigest.mockResolvedValue(imageId);
    mocks.testImageStructure.mockResolvedValue(undefined);
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('publishes the tested image, verifies its digest and removes the temporary alias', async () => {
    mocks.digest.mockReturnValueOnce(undefined).mockReturnValueOnce(digest);
    await new ImagePublisher(docker as unknown as DockerService).publishSingleImage('grafana-container', dir, { registry });
    expect(docker.prepareAlias).toHaveBeenCalledWith(imageId, candidate);
    expect(docker.removeAlias).toHaveBeenCalledWith(candidate);
    expect(mocks.imageConfigDigest).toHaveBeenCalledWith(`${registry}/grafana-container@${digest}`);
    expect(readImageReceipt(dir, 'grafana-container').publications[registry]).toBe(`${registry}/grafana-container@${digest}`);
  });

  it('rejects candidates with changed structure tests before contacting Docker', async () => {
    writeFileSync(join(dir, '__tests__/grafana.cst.yaml'), 'changed');
    await expect(new ImagePublisher(docker as unknown as DockerService).publishSingleImage('grafana-container', dir, { registry }))
      .rejects.toThrow('no passing structure test');
    expect(docker.requireImage).not.toHaveBeenCalled();
  });

  it('does not push over an existing candidate', async () => {
    mocks.digest.mockReturnValue(digest);
    await new ImagePublisher(docker as unknown as DockerService).publishSingleImage('grafana-container', dir, { registry });
    expect(docker.pushImage).not.toHaveBeenCalled();
  });

  it('tests the published digest if the registry converts the config', async () => {
    mocks.digest.mockReturnValueOnce(undefined).mockReturnValueOnce(digest);
    mocks.imageConfigDigest.mockResolvedValue(`sha256:${'c'.repeat(64)}`);
    await new ImagePublisher(docker as unknown as DockerService).publishSingleImage('grafana-container', dir, { registry });
    const reference = `${registry}/grafana-container@${digest}`;
    expect(docker.pullDigest).toHaveBeenCalledWith(reference);
    expect(mocks.testImageStructure).toHaveBeenCalledWith('grafana-container', expect.any(String), reference);
    expect(docker.removeAlias).toHaveBeenCalledWith(reference);
    expect(readImageReceipt(dir, 'grafana-container').publicationTests?.[registry]?.reference).toBe(reference);
  });

  it('rejects an unrelated pre-existing candidate', async () => {
    mocks.digest.mockReturnValue(digest);
    mocks.imageConfigDigest.mockResolvedValue(`sha256:${'c'.repeat(64)}`);
    await expect(new ImagePublisher(docker as unknown as DockerService).publishSingleImage('grafana-container', dir, { registry }))
      .rejects.toThrow('Existing candidate');
    expect(docker.pushImage).not.toHaveBeenCalled();
  });

  it('does not approve a converted publication when its structure test fails', async () => {
    mocks.digest.mockReturnValueOnce(undefined).mockReturnValueOnce(digest);
    mocks.imageConfigDigest.mockResolvedValue(`sha256:${'c'.repeat(64)}`);
    mocks.testImageStructure.mockRejectedValue(new Error('published structure test failed'));
    await expect(new ImagePublisher(docker as unknown as DockerService).publishSingleImage('grafana-container', dir, { registry }))
      .rejects.toThrow('published structure test failed');
    const receipt = readImageReceipt(dir, 'grafana-container');
    expect(receipt.publications[registry]).toBe(`${registry}/grafana-container@${digest}`);
    expect(receipt.publicationTests?.[registry]).toBeUndefined();
    expect(docker.removeAlias).toHaveBeenCalledWith(`${registry}/grafana-container@${digest}`);
  });
});
