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
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import type Docker from 'dockerode';

vi.mock('node:os', () => ({ homedir: vi.fn(() => '/home/test-user') }));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, readFileSync: vi.fn() };
});

import { DockerService } from '../docker-service.js';

const basicAuth = (pair: string) => Buffer.from(pair).toString('base64');

describe('DockerService Unit Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });
  it('tagImage should extract strings correctly and execute tag commands', async () => {
    const mockImage = {
      tag: vi.fn().mockResolvedValue(undefined),
    };
    const mockDockerInstance = {
      getImage: vi.fn().mockReturnValue(mockImage),
    } as unknown as Docker;

    const service = new DockerService(mockDockerInstance);
    await service.tagImage('local/grafana:latest', 'localhost:32443/ai-crew-suite/grafana:latest');

    expect(mockDockerInstance.getImage).toHaveBeenCalledWith('local/grafana:latest');
    expect(mockImage.tag).toHaveBeenCalledWith({
      repo: 'localhost:32443/ai-crew-suite/grafana',
      tag: 'latest',
    });
  });

  it('pushImage should resolve the exact remote digest from the terminal push status frame', async () => {
    const mockStream = {};
    const mockImage = {
      push: vi.fn().mockResolvedValue(mockStream),
    };

    const mockDockerInstance = {
      getImage: vi.fn().mockReturnValue(mockImage),
      modem: {
        // Simulate the daemon's terminal push status frame, mirroring docker CLI output
        followProgress: vi.fn((stream, onFinished, onProgress) => {
          onProgress({ status: 'The push refers to repository [localhost:32443/ai-crew-suite/grafana]' });
          onProgress({ status: `latest: digest: sha256:${'deadbeef'.repeat(8)} size: 2003` });
          onFinished(null, []);
        }),
      },
    } as unknown as Docker;

    const service = new DockerService(mockDockerInstance);
    const targetTag = 'localhost:32443/ai-crew-suite/grafana:latest';

    const digestResult = await service.pushImage(targetTag);

    expect(mockImage.push).toHaveBeenCalled();
    // Verify it composed the absolute registry reference from the pushed manifest digest
    expect(digestResult).toBe(`localhost:32443/ai-crew-suite/grafana@sha256:${'deadbeef'.repeat(8)}`);
  });

  it('pushImage should surface push stream error frames as declarative failures', async () => {
    const mockImage = {
      push: vi.fn().mockResolvedValue({}),
    };

    const mockDockerInstance = {
      getImage: vi.fn().mockReturnValue(mockImage),
      modem: {
        followProgress: vi.fn((stream, onFinished, onProgress) => {
          onProgress({ errorDetail: { message: 'denied: requested access to the resource is denied' } });
          onFinished(null, []);
        }),
      },
    } as unknown as Docker;

    const service = new DockerService(mockDockerInstance);

    await expect(service.pushImage('localhost:32443/ai-crew-suite/grafana:latest'))
      .rejects
      .toThrow('Remote registry push stream failed');
  });

  it('pushImage should forward registry credentials from the docker CLI configuration for remote registries', async () => {
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        auths: {
          'https://index.docker.io/v1/': { auth: basicAuth('hub-user:hub-token') },
          'ghcr.io': { auth: basicAuth('gh-bot:ghcr-token') },
        },
      })
    );

    const mockImage = {
      push: vi.fn().mockResolvedValue({}),
      inspect: vi.fn(),
    };
    const mockDockerInstance = {
      getImage: vi.fn().mockReturnValue(mockImage),
      modem: {
        followProgress: vi.fn((stream, onFinished, onProgress) => {
          onProgress({ status: `latest: digest: sha256:${'deadbeef'.repeat(8)} size: 2003` });
          onFinished(null, []);
        }),
      },
    } as unknown as Docker;

    const service = new DockerService(mockDockerInstance);

    await service.pushImage('ghcr.io/ai-crew-suite/workbench/grafana-container:latest');

    expect(mockImage.push).toHaveBeenCalledWith(
      expect.objectContaining({
        authconfig: expect.objectContaining({
          username: 'gh-bot',
          password: 'ghcr-token',
          serveraddress: 'https://ghcr.io',
        }),
      })
    );
  });

  it('pushImage should throw a declarative error if the push stream contains no digest frame', async () => {
    const mockImage = {
      push: vi.fn().mockResolvedValue({}),
    };

    const mockDockerInstance = {
      getImage: vi.fn().mockReturnValue(mockImage),
      modem: { followProgress: vi.fn((stream, onFinished) => onFinished(null, [])) },
    } as unknown as Docker;

    const service = new DockerService(mockDockerInstance);

    await expect(service.pushImage('localhost:32443/ai-crew-suite/grafana:latest'))
      .rejects
      .toThrow('Failed to isolate a remote distribution digest');
  });
});
