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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ImagePublisher } from '../publish.js';
import { DockerService } from '../docker-service.js';
import { SigningService } from '../signing-service.js';
import fs from 'node:fs';

describe('ImagePublisher Core Quality Pipeline', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('correctly orchestrates tagging, pushing, and native signature attachment', async () => {
    // 1. Spy on existsSync to simulate finding a valid key on disk safely under ESM
    const existsSyncSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    process.env['COSIGN_PASSWORD'] = 'mock-secure-pass';

    // 2. Build clean mocks of our low-level infrastructure dependencies
    const mockDockerService = {
      tagImage: vi.fn().mockResolvedValue(undefined),
      pushImage: vi.fn().mockResolvedValue('localhost:32443/ai-crew-suite/grafana@sha256:fakehash123'),
    } as unknown as DockerService;

    const mockSigningService = {
      signDigest: vi.fn().mockResolvedValue(undefined),
    } as unknown as SigningService;

    const publisher = new ImagePublisher(mockDockerService, mockSigningService);

    await publisher.publishSingleImage('grafana', {
      registry: 'localhost:32443/ai-crew-suite',
      imageTag: 'latest',
    });

    // 3. Assert execution contracts matched perfectly
    expect(mockDockerService.tagImage).toHaveBeenCalledWith(
      'local/grafana:latest',
      'localhost:32443/ai-crew-suite/grafana:latest'
    );
    expect(mockDockerService.pushImage).toHaveBeenCalledWith('localhost:32443/ai-crew-suite/grafana:latest');

    // Assert sign service was executed with our simulated parameters
    expect(mockSigningService.signDigest).toHaveBeenCalledWith(
      'localhost:32443/ai-crew-suite/grafana@sha256:fakehash123',
      expect.objectContaining({
        isCI: false,
        cosignPass: 'mock-secure-pass',
      })
    );

    existsSyncSpy.mockRestore();
  });
});
