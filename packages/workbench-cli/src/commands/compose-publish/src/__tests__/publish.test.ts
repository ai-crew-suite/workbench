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
import fs from 'node:fs';
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
  const actual = await importOriginal<typeof import('../../../../utils/workspace.js')>();
  return { ...actual, hasBinary: mocks.hasBinary };
});

const digest = `sha256:${'a'.repeat(64)}`;
const localOptions = { registry: 'localhost:32443/ai-crew-suite', imageTag: 'latest' };

describe('ComposeArtifactPublisher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CI', 'false');
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
        '--format', 'json',
        '--annotation', 'org.opencontainers.image.title=AI Crew Suite Compose Deployment',
        '--annotation', 'org.opencontainers.image.description=OCI Artifact bundle containing the official uninterpolated docker-compose.yml suite infrastructure configuration.',
        '--annotation', 'org.opencontainers.image.vendor=AI Crew Suite',
        'localhost:32443/ai-crew-suite/compose:latest',
        'compose.yml:application/vnd.docker.compose.file+yaml',
      ],
      expect.objectContaining({
        cwd: path.join(findRepoRoot(process.cwd()), 'packages/deploy/compose/src'),
        encoding: 'utf-8',
      }),
    );
    const args = mocks.spawn.mock.calls[0]?.[1] as string[];
    const cwd = mocks.spawn.mock.calls[0]?.[2].cwd as string;
    expect(fs.existsSync(path.resolve(cwd, args.at(-1)!.split(':')[0]!))).toBe(true);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining(
      `localhost:32443/ai-crew-suite/compose@${digest}`,
    ));
  });

  it('uses HTTPS for remote registries and supports an explicit HTTP override', async () => {
    const publisher = new ComposeArtifactPublisher();
    await publisher.publishArtifact({ registry: 'ghcr.io/example', imageTag: 'v1' });
    expect(mocks.spawn.mock.calls[0]?.[1]).toEqual([
      'push', '--artifact-type', 'application/vnd.docker.compose.project',
      '--format', 'json',
      '--annotation', 'org.opencontainers.image.title=AI Crew Suite Compose Deployment',
      '--annotation', 'org.opencontainers.image.description=OCI Artifact bundle containing the official uninterpolated docker-compose.yml suite infrastructure configuration.',
      '--annotation', 'org.opencontainers.image.vendor=AI Crew Suite',
      'ghcr.io/example/workbench-compose:v1',
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
      expect.objectContaining({
        keyPath: expect.stringContaining('cosign.key'),
        isCI: false,
        allowHttpRegistry: true,
      }),
    );
  });

  it.each([
    ['loopback HTTP', 'localhost:32443/ai-crew-suite', undefined, true],
    ['explicit HTTP', 'registry.example/team', true, true],
    ['HTTPS', 'ghcr.io/example', undefined, false],
  ])('passes %s transport to keyless signing', async (_label, registry, plainHttp, allowHttpRegistry) => {
    vi.stubEnv('CI', 'true');
    mocks.hasBinary.mockReturnValue(true);
    const signer = new SigningService();
    const sign = vi.spyOn(signer, 'signDigest').mockResolvedValue();
    await new ComposeArtifactPublisher(signer).publishArtifact({ registry, imageTag: 'v1', plainHttp });
    expect(sign).toHaveBeenCalledWith(
      expect.stringContaining(`@${digest}`),
      expect.objectContaining({ isCI: true, allowHttpRegistry }),
    );
  });

  it.each([
    ['CI', 'true', 'localhost:32443/ai-crew-suite', true],
    ['local key', 'false', 'localhost:32443/ai-crew-suite', true],
    ['CI over HTTPS', 'true', 'ghcr.io/example', false],
  ])('passes registry transport through to Cosign for %s', async (_label, ci, registry, allowHttp) => {
    vi.stubEnv('CI', ci);
    vi.stubEnv('COSIGN_PRIVATE_KEY', 'test-key');
    vi.stubEnv('COSIGN_PASSWORD', 'test-password');
    mocks.hasBinary.mockReturnValue(true);
    mocks.spawn.mockImplementation((binary: string) =>
      binary === 'oras'
        ? { status: 0, stdout: JSON.stringify({ digest }), stderr: '' }
        : { status: 0 },
    );

    await new ComposeArtifactPublisher().publishArtifact({ registry, imageTag: 'v1' });
    expect(mocks.spawn).toHaveBeenCalledTimes(2);
    const [binary, args] = mocks.spawn.mock.calls[1] as [string, string[]];
    expect(binary).toBe('cosign');
    expect(args.includes('--allow-http-registry=true')).toBe(allowHttp);
    expect(args).not.toContain('--allow-insecure-registry');
  });

  it('surfaces real Cosign CI failure guidance after a successful push', async () => {
    vi.stubEnv('CI', 'true');
    mocks.hasBinary.mockReturnValue(true);
    mocks.spawn.mockImplementation((binary: string) =>
      binary === 'oras'
        ? { status: 0, stdout: JSON.stringify({ digest }), stderr: '' }
        : { status: 1 },
    );
    await expect(new ComposeArtifactPublisher().publishArtifact(localOptions))
      .rejects.toThrow(/OIDC identity and registry write credentials/);
  });

  it('propagates keyless signing failures after the artifact is pushed', async () => {
    vi.stubEnv('CI', 'true');
    mocks.hasBinary.mockReturnValue(true);
    const signer = new SigningService();
    vi.spyOn(signer, 'signDigest').mockRejectedValue(new Error('OIDC or registry authentication failed'));
    await expect(new ComposeArtifactPublisher(signer).publishArtifact(localOptions))
      .rejects.toThrow('OIDC or registry authentication failed');
    expect(mocks.spawn).toHaveBeenCalledOnce();
  });

  it('reports a missing ORAS executable', async () => {
    mocks.hasBinary.mockReturnValue(false);
    await expect(new ComposeArtifactPublisher().publishArtifact(localOptions))
      .rejects.toThrow('ORAS CLI is required');
    expect(mocks.spawn).not.toHaveBeenCalled();
  });

  it('reports push failures and does not sign', async () => {
    mocks.spawn.mockReturnValue({ status: 1, stderr: 'registry unavailable', stdout: JSON.stringify({ digest }) });
    const signer = new SigningService();
    const sign = vi.spyOn(signer, 'signDigest').mockResolvedValue();
    await expect(new ComposeArtifactPublisher(signer).publishArtifact(localOptions))
      .rejects.toThrow('registry unavailable');
    expect(sign).not.toHaveBeenCalled();
  });

  it('reports ORAS launch failures and signals without signing', async () => {
    const signer = new SigningService();
    const sign = vi.spyOn(signer, 'signDigest').mockResolvedValue();
    mocks.spawn.mockReturnValueOnce({ status: null, error: new Error('not found') });
    await expect(new ComposeArtifactPublisher(signer).publishArtifact(localOptions))
      .rejects.toThrow('Failed to start ORAS');
    mocks.spawn.mockReturnValueOnce({ status: null, signal: 'SIGTERM' });
    await expect(new ComposeArtifactPublisher(signer).publishArtifact(localOptions))
      .rejects.toThrow('terminated by signal SIGTERM');
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
