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
import { beforeEach, describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { WireMockClient } from '@ai-crew-suite/utils-wiremock';
import fs from 'fs';

/**
 * Extracts the async init function from a backend module feature.
 *
 * `createBackendModule` in current Backstage releases returns a feature object
 * that exposes its registrations via `getRegistrations()` instead of a callable
 * `register(env)` method; each registration carries the init function under
 * `registration.init.func`.
 */
const getModuleInit = (module: any) => module.getRegistrations()[0].init.func;

// Force complete system isolation for the filesystem
vi.mock('fs', () => {
  const mockExistsSync = vi.fn().mockReturnValue(false);
  const mockReaddirSync = vi.fn().mockReturnValue([]);
  return {
    default: { existsSync: mockExistsSync, readdirSync: mockReaddirSync },
    existsSync: mockExistsSync,
    readdirSync: mockReaddirSync,
  };
});

vi.mock('@ai-crew-suite/utils-wiremock', () => ({
  // Must be a constructable function: the module under test invokes
  // `new WireMockClient(...)` and arrow functions cannot be constructed.
  WireMockClient: vi.fn().mockImplementation(function WireMockClientImpl() {
    return {
      uploadDirectory: vi.fn().mockResolvedValue(undefined),
    };
  }),
}));

describe('wiremockBootstrapperModule Engine', () => {
  let wiremockBootstrapperModule: any;

  beforeAll(async () => {
    // Dynamic import forces Vitest to resolve the token AFTER the mocks are hoisted cleanly
    const mod = await import('../wiremockBootstrapper');
    wiremockBootstrapperModule = mod.wiremockBootstrapperModule;
  });

  beforeEach(() => {
    vi.stubEnv('MOCK_PROXY_URL', '');
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should exit early if no mockProxyUrl is configured or found in env', async () => {
    const mockConfig = { getOptionalString: vi.fn().mockReturnValue(undefined) };
    const infoSpy = vi.spyOn(console, 'info');

    await getModuleInit(wiremockBootstrapperModule)({ config: mockConfig as any });

    expect(mockConfig.getOptionalString).toHaveBeenCalledWith('drivers.mockProxyUrl');
    expect(WireMockClient).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('MOCK_PROXY_URL flag inactive'));
  });

  it('should load mockProxyUrl from process.env if config is missing', async () => {
    vi.stubEnv('MOCK_PROXY_URL', 'http://env-proxy:8080');
    const mockConfig = { getOptionalString: vi.fn().mockReturnValue(undefined) };

    await getModuleInit(wiremockBootstrapperModule)({ config: mockConfig as any });
    expect(WireMockClient).toHaveBeenCalledWith('http://env-proxy:8080');
  });

  it('should scan search roots and call uploadDirectory on valid mock paths', async () => {
    const mockConfig = { getOptionalString: vi.fn().mockReturnValue('http://config-proxy:8080') };

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      if (typeof p === 'string' && (p.endsWith('plugins') || p.endsWith('packages'))) return true;
      if (typeof p === 'string' && p.includes('test-plugin/src/__mocks__/wiremock')) return true;
      return false;
    });

    vi.mocked(fs.readdirSync).mockImplementation((p) => {
      if (typeof p === 'string' && p.endsWith('plugins')) return ['test-plugin'] as any;
      return [] as any;
    });

    await getModuleInit(wiremockBootstrapperModule)({ config: mockConfig as any });

    expect(WireMockClient).toHaveBeenCalledWith('http://config-proxy:8080');
    const mockClientInstance = vi.mocked(WireMockClient).mock.results[0]?.value;
    expect(mockClientInstance).toBeDefined();
    expect(mockClientInstance.uploadDirectory).toHaveBeenCalledWith(
      expect.stringContaining('plugins/test-plugin/src/__mocks__/wiremock')
    );
  });
});
