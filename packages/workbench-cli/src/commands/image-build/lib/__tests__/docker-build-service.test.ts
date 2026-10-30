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

import { DockerBuildService } from '../docker-build-service.js';

const basicAuth = (pair: string) => Buffer.from(pair).toString('base64');

function createMockDocker(
  followProgress: (stream: unknown, onFinished: (err?: unknown, res?: unknown) => void, onProgress?: (event: any) => void) => void,
) {
  return {
    buildImage: vi.fn().mockResolvedValue('mock-build-stream'),
    modem: { followProgress: vi.fn(followProgress) },
  };
}

describe('Docker Build Service Unit Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  const buildOptions = {
    t: 'local/grafana-container:latest',
    dockerfile: 'packages/deploy/containers/grafana/Dockerfile',
    labels: { 'org.opencontainers.image.vendor': 'AI Crew Suite' },
  };

  it('should forward resolved Docker Hub credentials as the daemon auth header', async () => {
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ auths: { 'https://index.docker.io/v1/': { auth: basicAuth('hub-user:hub-token') } } })
    );

    const mockDocker = createMockDocker((stream, onFinished) => onFinished(null, []));
    const service = new DockerBuildService(mockDocker as unknown as Docker);

    await service.build({} as NodeJS.ReadableStream, buildOptions);

    expect(mockDocker.buildImage).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        t: buildOptions.t,
        dockerfile: buildOptions.dockerfile,
        authconfig: expect.objectContaining({ username: 'hub-user', password: 'hub-token' }),
      })
    );
  });

  it('should omit the auth header entirely when no registry credentials are configured', async () => {
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    const mockDocker = createMockDocker((stream, onFinished) => onFinished(null, []));
    const service = new DockerBuildService(mockDocker as unknown as Docker);

    await service.build({} as NodeJS.ReadableStream, buildOptions);

    const passedOptions = mockDocker.buildImage.mock.calls[0]![1]!;
    expect(passedOptions.authconfig).toBeUndefined();
    expect(passedOptions.t).toBe(buildOptions.t);
  });

  it('should fail loudly when the build stream surfaces an error frame', async () => {
    const mockDocker = createMockDocker((stream, onFinished, onProgress) => {
      onProgress?.({ errorDetail: { message: 'unable to retrieve auth token: unauthorized' }, error: 'unauthorized' });
      onFinished(null, []);
    });
    const service = new DockerBuildService(mockDocker as unknown as Docker);

    await expect(service.build({} as NodeJS.ReadableStream, buildOptions)).rejects.toThrow(
      'Docker build stream failed: unable to retrieve auth token: unauthorized'
    );
  });

  it('should fail loudly when the daemon terminates the stream with an error', async () => {
    const mockDocker = createMockDocker((stream, onFinished) => onFinished(new Error('daemon exploded')));
    const service = new DockerBuildService(mockDocker as unknown as Docker);

    await expect(service.build({} as NodeJS.ReadableStream, buildOptions)).rejects.toThrow('daemon exploded');
  });

  it('prunes only dangling images without forcing removal', async () => {
    const pruneImages = vi.fn().mockResolvedValue({});
    const service = new DockerBuildService({ pruneImages } as unknown as Docker);

    await service.pruneImages();

    expect(pruneImages).toHaveBeenCalledWith({ filters: JSON.stringify({ dangling: ['true'] }) });
  });
});