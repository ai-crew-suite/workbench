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
import { describe, it, expect, vi } from 'vitest';
import { DockerService } from '../docker-service.js';
import type Docker from 'dockerode';

describe('DockerService Unit Suite', () => {
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
