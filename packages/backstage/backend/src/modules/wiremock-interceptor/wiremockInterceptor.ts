/*
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
import { coreServices, createBackendModule } from '@backstage/backend-plugin-api';

/**
 * PostgreSQL & Redis (Completely Safe)
 *
 * The global.fetch interceptor only catches HTTP/HTTPS traffic.
 *
 * PostgreSQL communicates over the native PostgreSQL wire protocol (pg driver over TCP port 5432).
 *
 * Redis communicates over the Redis Serialization Protocol (RESP over TCP port 6379).
 *
 * Because neither of these use the HTTP fetch API, their traffic will never touch the interceptor
 * loop, and they will run perfectly normal.
 *
 * PostgreSQL communicates over the native PostgreSQL wire protocol (pg driver over TCP port 5432).
 *
 * Redis communicates over the Redis Serialization Protocol (RESP over TCP port 6379).
 *
 * Because neither of these use the HTTP fetch API, their traffic will never touch the interceptor
 * loop, and they will run perfectly normal.
 */
export const globalWiremockInterceptorModule = createBackendModule({
  pluginId: 'api',
  moduleId: 'global-wiremock-interceptor',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
      },
      async init({ config }) {
        const mockProxyUrl = config.getOptionalString('drivers.mockProxyUrl')
          || process.env['MOCK_PROXY_URL'];
        if (!mockProxyUrl) return;

        console.info(`[WireMock Mesh] Intercepting outbound traffic -> ${mockProxyUrl}`);
        const proxyBase = mockProxyUrl.replace(/\/\$/, '');
        const originalFetch = global.fetch;

        global.fetch = async (input: Request | string | URL, init?: RequestInit) => {
          let targetUrl: URL;
          try {
            if (input instanceof Request) {
              targetUrl = new URL(input.url);
            } else if (input instanceof URL) {
              targetUrl = input;
            } else {
              targetUrl = input.startsWith('/')
                ? new URL(input, 'http://localhost')
                : new URL(input);
            }
          } catch {
            return originalFetch(input, init);
          }

          const hostname = targetUrl.hostname;
          const pathname = targetUrl.pathname;
          const isInternal =
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '::1' ||
            hostname === 'crew-infra' ||
            hostname === 'backstage' ||
            pathname.includes('__admin');

          if (isInternal) {
            return originalFetch(input, init);
          }

          // Rewrite external URLs into the WireMock proxy path, keeping the
          // original scheme marker so the mock server can resolve the real
          // target: https://pagerduty.com -> http://localhost:8080/://pagerduty.com
          const cleanUrl = targetUrl.href.replace(/^https?/, '');
          const interceptedUrl = `${proxyBase}/${cleanUrl}`;
          console.debug(`[WireMock Proxy] Routing ${targetUrl.href} to WireMock -> ${interceptedUrl}`);

          if (input instanceof Request) {
            const clonedRequest = input.clone();
            return originalFetch(new Request(interceptedUrl, clonedRequest));
          }
          return originalFetch(interceptedUrl, init);
        };
      },
    });
  },
});
