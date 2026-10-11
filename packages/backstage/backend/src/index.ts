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
import { createBackend } from '@backstage/backend-defaults';
import appPlugin from '@backstage/plugin-app-backend';
import proxyPlugin from '@backstage/plugin-proxy-backend';
import catalogPlugin from '@backstage/plugin-catalog-backend';
import techdocsPluginAlpha from '@backstage/plugin-techdocs-backend';
import scaffolderPlugin from '@backstage/plugin-scaffolder-backend';
import authPlugin from '@backstage/plugin-auth-backend';
import authGithubModule from '@backstage/plugin-auth-backend-module-github-provider';

import { EnterpriseCustomKindsProcessor } from './modules/catalog-schema-extensions';
import { PermissionModule } from './modules/test-permission-policy';
import { globalWiremockInterceptorModule } from './modules/wiremock-interceptor';
import { wiremockBootstrapperModule } from './modules/wiremock-bootstrapper';
import { rootConfigServiceFactory } from '@backstage/backend-defaults/rootConfig';
import { yourCustomBackendPlugin } from '../src';

// 1. Initialize the core Dependency Injection assembly container
const backend = createBackend();

// Override the default configuration service parameters
backend.add(
  rootConfigServiceFactory({
    argv: [
      '--config', 'app-config.yaml',
      '--config', 'app-config.local.yaml', // Merges multi-layered local overrides
    ],
    remote: {
      reloadIntervalSeconds: 60, // Poll for changes remotely every minute
    },
  })
);

/* OR
// Define a type-safe internal config service completely in-memory
const mockConfigService = createServiceFactory({
  service: coreServices.rootConfig,
  deps: {},
  async factory() {
    // Generate isolated configuration data programmatically
    const source = ConfigSources.inline({
      data: {
        app: { baseUrl: 'http://localhost:3000' },
        backend: {
          baseUrl: 'http://localhost:7007',
          cors: { origin: 'http://localhost:3000' },
        },
        myCustomPlugin: {
          secureApiKey: 'mock-dev-token-1234', // Hardcoded local credential fallback
        },
      },
      context: 'dev-sandbox-environment',
    });

    return await ConfigSources.toConfig(source);
  },
});

// Register your mock service container override
backend.add(mockConfigService);
*/

// 2. Attach modern core system plugins and alpha boundary routers
backend.add(appPlugin);
backend.add(proxyPlugin);
backend.add(catalogPlugin);
backend.add(techdocsPluginAlpha);
backend.add(scaffolderPlugin);

// 3. Attach authentication lifecycle plugins
backend.add(authPlugin);
backend.add(authGithubModule);

// 3.5. Inject local permission sandbox policy module override
backend.add(PermissionModule);

// 4. Inject custom extensions directly into the container stack
backend.add(EnterpriseCustomKindsProcessor);
backend.add(globalWiremockInterceptorModule);
backend.add(wiremockBootstrapperModule);

//backend.add(import('../src')); // Automatically registers your plugin locally

// 5. Fire the runtime network execution loop
backend.start();
