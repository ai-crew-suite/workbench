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
import path from 'node:path';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ComposeArtifactPublisher } from '../publish.js';
import { SigningService } from '../../../../utils/oci/index.js';
import { findRepoRoot } from '../../../../utils/workspace.js';

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
  hasBinary: vi.fn(),
}));

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, spawnSync: mocks.spawn };
});

vi.mock('../../../../utils/workspace', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../utils/workspace')>();
  return { ...actual, hasBinary: mocks.hasBinary };
});

const digest = `sha256:${'a'.repeat(64)}`;
const localOptions = { registry: 'localhost:32443/ai-crew-suite', imageTag: 'latest' };

describe('ComposeArtifactPublisher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    mocks.hasBinary.mockImplementation((name: string) => name === 'oras');
    mocks.spawn.mockReturnValue({ status: 0, stdout: JSON.stringify({ digest }), stderr: '' });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('pushes the original file as a Compose OCI artifact over local HTTP', async () => {
    await new ComposeArtifactPublisher().publishArtifact(localOptions);

    expect(mocks.spawn).toHaveBeenCalledOnce();
    expect(mocks.spawn).toHaveBeenCalledWith(
      'oras',
      [
        'push', '--plain-http', '--artifact-type', 'application/vnd.docker.compose.project',
        '--format', 'json', 'localhost:32443/ai-crew-suite/compose:latest',
        'compose.yml:application/vnd.docker.compose.file+yaml',
      ],
      expect.objectContaining({
        cwd: path.join(findRepoRoot(process.cwd()), 'packages/deploy/compose/src'),
        encoding: 'utf-8',
      }),
    );
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining(
      `localhost:32443/ai-crew-suite/compose@${digest}`,
    ));
  });

  it('uses HTTPS for remote registries and supports an explicit HTTP override', async () => {
    const publisher = new ComposeArtifactPublisher();
    await publisher.publishArtifact({ registry: 'ghcr.io/example', imageTag: 'v1' });
    expect(mocks.spawn.mock.calls[0]?.[1]).toEqual([
      'push', '--artifact-type', 'application/vnd.docker.compose.project',
      '--format', 'json', 'ghcr.io/example/workbench-compose:v1',
      'compose.yml:application/vnd.docker.compose.file+yaml',
    ]);
    await publisher.publishArtifact({ registry: 'registry.example/team', imageTag: 'v1', plainHttp: true });
    expect(mocks.spawn.mock.calls[1]?.[1]).toContain('--plain-http');
  });

  it('signs the pushed digest without dropping the registry port', async () => {
    mocks.hasBinary.mockReturnValue(true);
    vi.stubEnv('COSIGN_PRIVATE_KEY', 'test-key');
    vi.stubEnv('COSIGN_PASSWORD', 'test-password');
    const signer = new SigningService();
    const sign = vi.spyOn(signer, 'signDigest').mockResolvedValue();
    await new ComposeArtifactPublisher(signer).publishArtifact(localOptions);
    expect(sign).toHaveBeenCalledWith(
      `localhost:32443/ai-crew-suite/compose@${digest}`,
      expect.objectContaining({ keyPath: expect.stringContaining('cosign.key') }),
    );
  });

  it('reports a missing ORAS executable', async () => {
    mocks.hasBinary.mockReturnValue(false);
    await expect(new ComposeArtifactPublisher().publishArtifact(localOptions))
      .rejects.toThrow('ORAS CLI is required');
    expect(mocks.spawn).not.toHaveBeenCalled();
  });

  it('reports push failures and does not sign', async () => {
    mocks.spawn.mockReturnValue({ status: 1, stderr: 'registry unavailable', stdout: '' });
    const signer = new SigningService();
    const sign = vi.spyOn(signer, 'signDigest').mockResolvedValue();
    await expect(new ComposeArtifactPublisher(signer).publishArtifact(localOptions))
      .rejects.toThrow('registry unavailable');
    expect(sign).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid JSON', 'not json', 'invalid JSON'],
    ['missing digest', '{}', 'valid manifest digest'],
    ['malformed digest', '{"digest":"sha256:abc"}', 'valid manifest digest'],
    ['null response', 'null', 'valid manifest digest'],
  ])('rejects %s from ORAS', async (_name, stdout, message) => {
    mocks.spawn.mockReturnValue({ status: 0, stdout, stderr: '' });
    await expect(new ComposeArtifactPublisher().publishArtifact(localOptions))
      .rejects.toThrow(message);
  });
});
