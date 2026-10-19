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

/**
 * Extracts the async init function from a backend module feature.
 */
const getModuleInit = (module: any) => module.getRegistrations()[0].init.func;

describe('globalWiremockInterceptorModule (Robust Version)', () => {
  let originalFetch: typeof global.fetch;
  let globalWiremockInterceptorModule: any;

  beforeAll(async () => {
    // Forces clean module evaluation after Vitest framework configuration boots up
    const mod = await import('../wiremockInterceptor');
    globalWiremockInterceptorModule = mod.globalWiremockInterceptorModule;
  });

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.stubEnv('MOCK_PROXY_URL', '');
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should skip global fetch interception if explicitly disabled via configuration', async () => {
    const mockConfig = {
      getOptionalBoolean: vi.fn().mockReturnValue(false), // Explicitly disable
      getOptionalString: vi.fn().mockReturnValue('http://localhost:8080'),
    };

    await getModuleInit(globalWiremockInterceptorModule)({ config: mockConfig as any });
    expect(global.fetch).toBe(originalFetch);
    expect(mockConfig.getOptionalBoolean).toHaveBeenCalledWith('aiCrewSuite.modules.globalWiremockInterceptor.enabled');
  });

  it('should skip global fetch interception if mockProxyUrl configuration is missing', async () => {
    const mockConfig = {
      getOptionalBoolean: vi.fn().mockReturnValue(undefined), // Defaults to true
      getOptionalString: vi.fn().mockReturnValue(undefined),
    };

    await getModuleInit(globalWiremockInterceptorModule)({ config: mockConfig as any });
    expect(global.fetch).toBe(originalFetch);
  });

  it('should override global fetch when mockProxyUrl is configured and enabled', async () => {
    const mockConfig = {
      getOptionalBoolean: vi.fn().mockReturnValue(undefined), // Defaults to true
      getOptionalString: vi.fn().mockReturnValue('http://localhost:8080'),
    };

    await getModuleInit(globalWiremockInterceptorModule)({ config: mockConfig as any });
    expect(global.fetch).not.toBe(originalFetch);
  });

  describe('Fetch Interceptor Traversal Engine', () => {
    let mockFetchSpy: any;

    beforeEach(async () => {
      mockFetchSpy = vi.fn().mockResolvedValue({ ok: true } as Response);
      global.fetch = mockFetchSpy;

      const mockConfig = {
        getOptionalBoolean: vi.fn().mockReturnValue(undefined),
        getOptionalString: vi.fn().mockReturnValue('http://localhost:8080'),
      };
      await getModuleInit(globalWiremockInterceptorModule)({ config: mockConfig as any });
    });

    it('should bypass transformation loops on internal loopback endpoints', async () => {
      await global.fetch('http://localhost:7007/api/catalog');
      await global.fetch('http://127.0.0.1');
      await global.fetch('/relative/path');

      expect(mockFetchSpy).toHaveBeenNthCalledWith(1, 'http://localhost:7007/api/catalog', undefined);
      expect(mockFetchSpy).toHaveBeenNthCalledWith(2, 'http://127.0.0.1', undefined);
      expect(mockFetchSpy).toHaveBeenNthCalledWith(3, '/relative/path', undefined);
    });

    it('should bypass transformation loops on specialized proxy and administration endpoints', async () => {
      await global.fetch('http://backstage/services');
      await global.fetch('http://wiremock-service/__admin/mappings');

      expect(mockFetchSpy).toHaveBeenNthCalledWith(1, 'http://backstage/services', undefined);
      expect(mockFetchSpy).toHaveBeenNthCalledWith(2, 'http://wiremock-service/__admin/mappings', undefined);
    });

    it('should handle Request objects gracefully and bypass internal endpoints via proper constructor cloning', async () => {
      const mockRequest = new Request('http://localhost:7007/api/health');
      await global.fetch(mockRequest);

      expect(mockFetchSpy).toHaveBeenCalledWith(
        expect.toSatisfy((req: Request) => req instanceof Request && req.url === 'http://localhost:7007/api/health'),
        undefined
      );
    });

    it('should intercept external dependencies traffic and rewrite targets through mockProxyUrl', async () => {
      await global.fetch('https://pagerduty.com');

      // The origin-only URL is normalized by the URL parser, adding a trailing slash.
      expect(mockFetchSpy).toHaveBeenCalledWith('http://localhost:8080/://pagerduty.com/', undefined);
    });

    it('should intercept external Request objects and successfully rewrite with body/header maps intact', async () => {
      const mockExternalRequest = new Request('https://github.com', {
        method: 'POST',
        headers: { Authorization: 'Bearer token123' },
      });

      await global.fetch(mockExternalRequest);

      expect(mockFetchSpy).toHaveBeenCalledWith(
        expect.toSatisfy((req: Request) =>
          req instanceof Request &&
          req.url === 'http://localhost:8080/://github.com/' &&
          req.method === 'POST' &&
          req.headers.get('Authorization') === 'Bearer token123'
        )
      );
    });
  });
});
