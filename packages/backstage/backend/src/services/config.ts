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
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from 'yaml';
import { createServiceFactory, coreServices } from '@backstage/backend-plugin-api';
import { ConfigReader } from '@backstage/config';
import { JsonObject } from '@backstage/types';

/**
 * Programmatic Configuration Factory for Sandbox Environments.
 * Houses the enterprise dev sandbox settings natively inside TypeScript.
 */
export const mockConfigServiceFactory = createServiceFactory({
  service: coreServices.rootConfig,
  deps: {},
  async factory() {
    const appHost = process.env['APP_HOST'] || 'localhost';
    const appPort = process.env['APP_PORT'] || '3000';
    const backendHost = process.env['BACKEND_HOST'] || 'localhost';
    const backendPort = process.env['BACKEND_PORT'] || '7007';

    const programmaticConfig: JsonObject = {
      app: {
        title: 'AI Crew Suite Platform',
        baseUrl: `http://${appHost}:${appPort}`,
      },
      organization: {
        name: 'AI Crew Suite',
      },
      backend: {
        baseUrl: `http://${backendHost}:${backendPort}`,
        logger: {
          level: 'debug',
        },
        listen: {
          port: parseInt(backendPort, 10),
        },
        auth: {
          allowGuestAccess: true,
          externalAccess: [
            {
              type: 'static',
              options: {
                token: process.env['BACKEND_STATIC_TOKEN'] || 'dev-secret-token-placeholder',
                subject: 'development-tester-agent',
              },
            },
          ],
        },
        cors: {
          origin: [
            `http://${appHost}:${appPort}`,
            'http://localhost:3000',
            'http://127.0.0.1:3000',
          ],
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
          credentials: true,
        },
        database: {
          client: 'better-sqlite3',
          connection: ':memory:',
          plugin: {
            auth: { client: 'better-sqlite3', connection: ':memory:' },
            notifications: { client: 'better-sqlite3', connection: ':memory:' },
            scaffolder: { client: 'better-sqlite3', connection: ':memory:' },
            signals: { client: 'better-sqlite3', connection: ':memory:' },
          },
        },
        reading: {
          allow: [
            { host: process.env['ALLOWED_HOST'] || 'localhost' },
          ],
        },
      },
      catalog: {
        rules: [
          {
            allow: [
              'API',
              'ArchitectureDecision',
              'Component',
              'DataProduct',
              'Domain',
              'Group',
              'Location',
              'Model',
              'Product',
              'Resource',
              'System',
              'Template',
              'User',
              'Vulnerability',
            ],
          },
        ],
        locations: [
          // Optional local fixture files resolved relative to the executing
          // plugin's working directory. The OptionalLocalFixturesProcessor
          // skips these silently when the files do not exist.
          {
            type: 'crew-suite-optional-fixtures',
            target: './dev/location.yaml',
          },
          {
            type: 'crew-suite-optional-fixtures',
            target: './dev/catalog-info.yaml',
          },
        ],
      },
      scaffolder: {
        concurrentTasks: 5,
        // Disables background catalog worker polling for templates to allow instant local reloads
        experimentalNotLoadingTemplatesFromCatalog: true,
      },
      search: {
        collators: {
          catalog: {
            schedule: {
              frequency: { seconds: 60 },
              timeout: { minutes: 3 },
              initialDelay: { seconds: 15 },
            },
          },
          // Register the TechDocs indexer so local documentation sheets become searchable
          techdocs: {
            schedule: {
              frequency: { minutes: 10 },
              timeout: { minutes: 5 },
              initialDelay: { seconds: 30 },
            },
          },
        },
      },
      techdocs: {
        builder: 'local',
        generator: { runIn: 'local' },
        publisher: {
          type: 'local',
          local: {
            // Point to the repository root as the baseline publish folder
            // context for clients adding their own techdocs mock fixtures
            publishFolder: resolve(process.cwd()),
          },
        },
      },
      drivers: {
        mockProxyUrl: process.env['MOCK_PROXY_URL'] || 'http://localhost:8080',
      },
    };

    const pluginConfigPath = resolve(process.cwd(), 'dev/app-config.dev.yaml');
    let fileConfigData: JsonObject = {};

    try {
      if (existsSync(pluginConfigPath)) {
        const fileContents = readFileSync(pluginConfigPath, 'utf8');
        fileConfigData = parse(fileContents) as JsonObject;
        console.log(`[Config-Factory] Loaded local plugin config from: ${pluginConfigPath}`);
      }
    } catch (error) {
      // Gracefully log or throw if the file exists but has broken formatting
      console.error(`[Config-Factory] Failed to read or parse YAML config at ${pluginConfigPath}:`, error);
    }

    // Assemble the priority array inside fromConfigs
    return ConfigReader.fromConfigs([
      // Priority 1 (Lowest/Baseline): Hardcoded programmatic options
      {
        context: 'workbench-backend-programmatic-config',
        data: programmaticConfig,
      },
      // Priority 2 (Medium): Values parsed directly from your dev/app-config.dev.yaml file
      {
        context: `file:${pluginConfigPath}`,
        data: fileConfigData || {},
      },
      // Priority 3 (Highest): Overrides injected into the environment by the CLI process launcher
      ...JSON.parse(process.env['APP_CONFIG'] || '[]'),
    ]);
  },
});
