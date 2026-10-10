import { coreServices, createBackendModule } from '@backstage/backend-plugin-api';
import { WireMockClient } from '@ai-crew-suite/wiremock-utils';
import path from 'path';
import fs from 'fs';

export const wiremockBootstrapperModule = createBackendModule({
  pluginId: 'api', // Scopes neatly to your common core layer
  moduleId: 'wiremock-automatic-fixtures',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
      },
      async init({ config }) {
        const mockProxyUrl = config.getOptionalString('drivers.mockProxyUrl') || process.env.MOCK_PROXY_URL;
        if (!mockProxyUrl) {
          console.info('[WireMock Ingestion] MOCK_PROXY_URL flag inactive. Skipping automatic directory scans.');
          return;
        }

        const wm = new WireMockClient(mockProxyUrl);
        console.info('[WireMock Ingestion] Activating automatic workspace scans for plugin baseline fixtures...');

        // In a typical Backstage monorepo layout, plugins live in the 'plugins' or 'packages' folder roots
        const searchRoots = [
          path.resolve(__dirname, '../../../../plugins'),
          path.resolve(__dirname, '../../../../packages'),
        ];

        for (const root of searchRoots) {
          if (!fs.existsSync(root)) continue;

          const directories = fs.readdirSync(root);
          for (const dirName of directories) {
            // Target path structure: plugins/your-driver-plugin/src/__mocks__/wiremock
            const mockPath = path.join(root, dirName, 'src', '__mocks__', 'wiremock');

            if (fs.existsSync(mockPath)) {
              console.info(`[WireMock Ingestion] Detected fixture profile for plugin [${dirName}] at ${mockPath}`);
              await wm.uploadDirectory(mockPath);
            }
          }
        }
        console.info('[WireMock Ingestion] Baseline fixture injection cycle finalized cleanly.');
      },
    });
  },
});
