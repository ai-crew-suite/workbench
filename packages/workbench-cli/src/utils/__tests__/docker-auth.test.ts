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

vi.mock('node:os', () => ({ homedir: vi.fn(() => '/home/test-user') }));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, readFileSync: vi.fn() };
});

import { registryHostFromImageReference, resolveRegistryAuth } from '../docker-auth.js';

describe('Docker Registry Authentication Resolution Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  const basicAuth = (pair: string) => Buffer.from(pair).toString('base64');

  it('should prefer DOCKER_HUB environment overrides for Docker Hub hosts', () => {
    vi.stubEnv('DOCKER_HUB_USERNAME', 'ci-bot');
    vi.stubEnv('DOCKER_HUB_TOKEN', 'ci-token');

    expect(resolveRegistryAuth('docker.io')).toEqual({
      username: 'ci-bot',
      password: 'ci-token',
      serveraddress: 'https://index.docker.io/v1/',
    });
  });

  it('should decode basic auth entries from the docker CLI configuration for any Docker Hub alias', () => {
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        auths: {
          'https://index.docker.io/v1/': { auth: basicAuth('hub-user:hub-token') },
        },
      })
    );

    expect(resolveRegistryAuth('registry-1.docker.io')).toEqual({
      username: 'hub-user',
      password: 'hub-token',
      serveraddress: 'https://index.docker.io/v1/',
    });
  });

  it('should resolve credentials for explicit remote distribution registries like GHCR', () => {
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        auths: {
          'https://index.docker.io/v1/': { auth: basicAuth('hub-user:hub-token') },
          'ghcr.io': { auth: basicAuth('gh-bot:ghcr-token') },
        },
      })
    );

    expect(resolveRegistryAuth('ghcr.io')).toEqual({
      username: 'gh-bot',
      password: 'ghcr-token',
      serveraddress: 'https://ghcr.io',
    });
  });

  it('should never let stray Docker Desktop token entries shadow the canonical Docker Hub entry', () => {
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        auths: {
          // Stray entries normalized to a Docker Hub host; ordered FIRST to prove
          // canonical entry selection does not depend on key ordering
          'https://index.docker.io/v1/access-token': { auth: basicAuth('stray-token-user:stray-secret') },
          'https://index.docker.io/v1/refresh-token': { auth: basicAuth('stray-refresh-user:stray-secret') },
          'https://index.docker.io/v1/': { auth: basicAuth('hub-user:hub-token') },
        },
      })
    );

    expect(resolveRegistryAuth('docker.io')).toEqual({
      username: 'hub-user',
      password: 'hub-token',
      serveraddress: 'https://index.docker.io/v1/',
    });
  });

  it('should return undefined for unauthenticated local registries', () => {
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ auths: { 'ghcr.io': { auth: basicAuth('gh-bot:ghcr-token') } } })
    );

    expect(resolveRegistryAuth('localhost:32443')).toBeUndefined();
  });

  it('should return undefined when the docker CLI configuration is absent or malformed', () => {
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });
    expect(resolveRegistryAuth('docker.io')).toBeUndefined();

    vi.mocked(readFileSync).mockReturnValue('{not-valid-json');
    expect(resolveRegistryAuth('ghcr.io')).toBeUndefined();
  });

  it('should extract registry hosts from fully-qualified image references', () => {
    expect(registryHostFromImageReference('ghcr.io/ai-crew-suite/workbench/grafana:latest')).toBe('ghcr.io');
    expect(registryHostFromImageReference('localhost:32443/ai-crew-suite/grafana:latest')).toBe('localhost:32443');
    // Unqualified references resolve to Docker Hub, mirroring daemon resolution rules
    expect(registryHostFromImageReference('local/grafana-container:latest')).toBe('docker.io');
  });
});