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
  // Shared mock instances guarantee the named export bindings observed by the
  // module under test reference the exact same test doubles as the test file
  const mocked = {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    rmSync: vi.fn(),
  };
  return {
    ...actual,
    ...mocked,
    default: { ...actual, ...mocked },
  };
});

vi.mock('tar', () => ({
  default: { c: vi.fn().mockReturnValue('mock-tar-stream') },
  c: vi.fn().mockReturnValue('mock-tar-stream'),
}));

import { existsSync, readFileSync, rmSync } from 'node:fs';

describe('ImageBuilder Unified Core Suite', () => {
  let mockBuildService: any;

  beforeEach(() => {
    vi.resetAllMocks();
    // Re-establish baseline filesystem presence after the reset clears factory implementations
    vi.mocked(existsSync).mockReturnValue(true);
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
    vi.mocked(readFileSync).mockReturnValue(
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
    vi.mocked(readFileSync).mockReturnValue('{}');

    const builder = new ImageBuilder(mockBuildService as unknown as DockerBuildService);
    vi.spyOn(builder, 'resolveMetadataLabels').mockReturnValue({});

    await builder.compileImage('/root', 'worker-service', '/root/packages/worker-service', {
      registry: 'ghcr.io/ai-crew-suite',
      imageTag: 'latest',
    });

    expect(mockBuildService.build).toHaveBeenCalled();
    expect(mockBuildService.pushImage).toHaveBeenCalledWith('local/worker-service:latest');
  });

  it('warns without failing a successful build when pruning encounters an image in use', async () => {
    vi.stubEnv('CI', 'false');
    const pruneError = new Error('image is in use by a container');
    mockBuildService.pruneImages.mockRejectedValue(pruneError);
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const builder = new ImageBuilder(mockBuildService as unknown as DockerBuildService);
    vi.spyOn(builder, 'resolveMetadataLabels').mockReturnValue({});

    await expect(
      builder.compileImage('/root', 'mem0-container', '/root/packages/mem0', {
        registry: 'local',
        imageTag: 'latest',
      })
    ).resolves.toBeUndefined();

    expect(vi.mocked(rmSync)).toHaveBeenCalledWith('/root/out-mem0-container', { recursive: true, force: true });
    expect(mockBuildService.pruneImages).toHaveBeenCalledOnce();
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('Unable to prune dangling images'), pruneError);
  });

  it.each(['build', 'pushImage'] as const)(
    'preserves a %s failure when image pruning also fails',
    async (operation) => {
      vi.stubEnv('CI', 'true');
      const operationError = new Error(`${operation} failed`);
      const pruneError = new Error('daemon unavailable');
      mockBuildService[operation].mockRejectedValue(operationError);
      mockBuildService.pruneImages.mockRejectedValue(pruneError);
      const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const builder = new ImageBuilder(mockBuildService as unknown as DockerBuildService);
      vi.spyOn(builder, 'resolveMetadataLabels').mockReturnValue({});

      await expect(
        builder.compileImage('/root', 'mem0-container', '/root/packages/mem0', {
          registry: 'local',
          imageTag: 'latest',
        })
      ).rejects.toBe(operationError);

      expect(mockBuildService.pruneImages).toHaveBeenCalledOnce();
      expect(warning).toHaveBeenCalledWith(expect.stringContaining('Unable to prune dangling images'), pruneError);
    }
  );
});
