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
import { coreServices, createBackendModule } from '@backstage/backend-plugin-api';
import { WireMockClient } from '@ai-crew-suite/utils-wiremock';
import path from 'path';
import fs from 'fs';

export const wiremockBootstrapperModule = createBackendModule({
  pluginId: 'api',
  moduleId: 'wiremock-automatic-fixtures',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
      },
      async init({ config }) {
        const isEnabled = config.getOptionalBoolean('aiCrewSuite.modules.wiremockBootstrapper.enabled') ?? true;

        if (!isEnabled) {
          console.log('[WireMock-Module] wiremock-automatic-fixtures is explicitly disabled via configuration. Skipping workspace scans.');
          return;
        }

        const mockProxyUrl = config.getOptionalString('drivers.mockProxyUrl') || process.env['MOCK_PROXY_URL'];
        if (!mockProxyUrl) {
          console.info('[WireMock Ingestion] MOCK_PROXY_URL flag inactive. Skipping automatic directory scans.');
          return;
        }

        const wm = new WireMockClient(mockProxyUrl);
        console.info('[WireMock Ingestion] Activating automatic workspace scans for plugin baseline fixtures...');

        const searchRoots = [
          path.resolve(__dirname, '../../../../plugins'),
          path.resolve(__dirname, '../../../../packages'),
        ];

        for (const root of searchRoots) {
          if (!fs.existsSync(root)) continue;

          const directories = fs.readdirSync(root);
          for (const dirName of directories) {
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
