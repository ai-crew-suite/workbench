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
import { ImageBuilder } from '../build.js';
import { DockerBuildService } from '../docker-build-service.js';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
    readFileSync: vi.fn(),
    rmSync: vi.fn(),
  };
});

vi.mock('tar', () => ({
  default: { c: vi.fn().mockReturnValue('mock-tar-stream') },
  c: vi.fn().mockReturnValue('mock-tar-stream'),
}));

import fs from 'node:fs';

describe('ImageBuilder Unified Core Suite', () => {
  let mockBuildService: any;

  beforeEach(() => {
    vi.resetAllMocks();
    mockBuildService = {
      build: vi.fn().mockResolvedValue(undefined),
      pruneImages: vi.fn().mockResolvedValue(undefined),
      pushImage: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('assembles a localized development target image extracting full package label metrics', async () => {
    // Fix: Return an object with name populated matching package.json specifications
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({
        name: '@ai-crew-suite/gateway-service',
        description: 'Gateway edge runtime component',
        license: 'MIT',
        repository: { url: 'git+https://github.com' },
      })
    );

    const builder = new ImageBuilder(mockBuildService as unknown as DockerBuildService);
    const labels = builder.resolveMetadataLabels('@ai-crew-suite/gateway-service', '/root/packages/gateway-service');

    expect(labels['org.opencontainers.image.title']).toBe('@ai-crew-suite/gateway-service');
    expect(labels['org.opencontainers.image.description']).toBe('Gateway edge runtime component');
    expect(labels['org.opencontainers.image.source']).toBe('https://github.com');
  });

  it('triggers a sequential out-of-band registry push when operating in CI environment frames', async () => {
    vi.stubEnv('CI', 'true');
    vi.spyOn(fs, 'readFileSync').mockReturnValue('{}');

    const builder = new ImageBuilder(mockBuildService as unknown as DockerBuildService);
    vi.spyOn(builder, 'resolveMetadataLabels').mockReturnValue({});

    await builder.compileImage('/root', 'worker-service', '/root/packages/worker-service', {
      registry: 'ghcr.io/ai-crew-suite',
      imageTag: 'latest',
    });

    expect(mockBuildService.build).toHaveBeenCalled();
    expect(mockBuildService.pushImage).toHaveBeenCalledWith('local/worker-service:latest');
  });
});
