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

  it('pushImage should pull the exact remote RepoDigest string matching the destination registry path', async () => {
    const mockStream = {};
    const mockImage = {
      push: vi.fn().mockResolvedValue(mockStream),
      inspect: vi.fn().mockResolvedValue({
        RepoDigests: [
          // Simulate the typical Docker engine output containing both storage keys
          'docker.io/local/grafana@sha256:localhashxxx',
          'localhost:32443/ai-crew-suite/grafana@sha256:true-remote-digest-hash-abc'
        ],
      }),
    };

    const mockDockerInstance = {
      getImage: vi.fn().mockReturnValue(mockImage),
      modem: {
        // Automatically mock streaming loop completions successfully
        followProgress: vi.fn((stream, cb) => cb(null, [])),
      },
    } as unknown as Docker;

    const service = new DockerService(mockDockerInstance);
    const targetTag = 'localhost:32443/ai-crew-suite/grafana:latest';

    const digestResult = await service.pushImage(targetTag);

    expect(mockImage.push).toHaveBeenCalled();
    // Verify it ignored the local storage digest and extracted the absolute Zot reference path
    expect(digestResult).toBe('localhost:32443/ai-crew-suite/grafana@sha256:true-remote-digest-hash-abc');
  });

  it('pushImage should throw a declarative error if no matching distribution registry digest exists', async () => {
    const mockImage = {
      push: vi.fn().mockResolvedValue({}),
      inspect: vi.fn().mockResolvedValue({ RepoDigests: [] }),
    };
    const mockDockerInstance = {
      getImage: vi.fn().mockReturnValue(mockImage),
      modem: { followProgress: vi.fn((stream, cb) => cb(null, [])) },
    } as unknown as Docker;

    const service = new DockerService(mockDockerInstance);

    await expect(service.pushImage('localhost:32443/ai-crew-suite/grafana:latest'))
      .rejects
      .toThrow('Failed to isolate a remote distribution digest');
  });
});
