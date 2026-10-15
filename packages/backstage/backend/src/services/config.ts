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
import { createServiceFactory, coreServices } from '@backstage/backend-plugin-api';
import { ConfigReader } from '@backstage/config';

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

    // Directly instantiates a full type-safe configuration layer in-memory
    return new ConfigReader({
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
          {
            type: 'file',
            target: process.env['MOCK_FIXTURES_PATH'] || '../../fixtures/location.yaml',
          },
          {
            type: process.env['CONSUMER_CATALOG_TYPE'] || 'file',
            target: process.env['CONSUMER_CATALOG_TARGET'] || '../backend/skeleton/empty-fallback.yaml',
          },
        ],
      },
      techdocs: {
        builder: 'local',
        generator: { runIn: 'local' },
        publisher: {
          type: 'local',
          local: {
            publishFolder: process.env['CONSUMER_TECHDOCS_ROOT'] || '../../mock-fixtures/techdocs',
          },
        },
      },
      scaffolder: {
        concurrentTasks: 5,
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
        },
      },
      drivers: {
        mockProxyUrl: process.env['MOCK_PROXY_URL'] || 'http://localhost:8080',
      },
    });
  },
});
