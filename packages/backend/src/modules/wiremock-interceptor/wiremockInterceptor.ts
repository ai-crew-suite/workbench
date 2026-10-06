import { coreServices, createBackendModule } from '@backstage/backend-plugin-api';

/*
PostgreSQL & Redis (Completely Safe)The global.fetch interceptor only catches HTTP/HTTPS traffic.

PostgreSQL communicates over the native PostgreSQL wire protocol (pg driver over TCP port 5432).

Redis communicates over the Redis Serialization Protocol (RESP over TCP port 6379).

Because neither of these use the HTTP fetch API, their traffic will never touch the interceptor loop, and they will run perfectly normal.
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
          || process.env.MOCK_PROXY_URL;

        if (!mockProxyUrl) return;

        console.info(`[WireMock Mesh] Intercepting outbound traffic -> ${mockProxyUrl}`);

        const originalFetch = global.fetch;
        global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
          let urlString = typeof input === 'string' ? input : input.toString();
          if (input instanceof Request) urlString = input.url;

          // 🛑 BYPASS RULES: Do not intercept internal infrastructure HTTP calls
          const isInternal =
            urlString.includes('localhost:') ||
            urlString.includes('127.0.0.1:') ||
            urlString.includes('::1') ||
            urlString.startsWith('/') ||               // Relative paths
            urlString.includes('backstage:') ||       // Internal Docker Compose DNS if named 'backstage'
            urlString.includes('__admin') ||          // WireMock health/admin checks
            urlString.includes('crew-infra');         // Any other internal service mesh names

          if (isInternal) {
            return originalFetch(input, init);
          }

          // 🔀 INTERCEPT: Transform external calls for your crew-infra-mocks container
          // https://pagerduty.com -> http://localhost:8080/://pagerduty.com
          const cleanUrl = urlString.replace(/^https?:\/\//, '');
          const interceptedUrl = `${mockProxyUrl.replace(/\/$/, '')}/${cleanUrl}`;

          console.debug(`[WireMock Proxy] Routing ${urlString} to WireMock -> ${interceptedUrl}`);

          return originalFetch(interceptedUrl, init);
        };
      },
    });
  },
});
