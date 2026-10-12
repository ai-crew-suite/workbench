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
import path from 'path';
//import { rootConfigServiceFactory } from '@backstage/backend-defaults/rootConfig';
import appPlugin from '@backstage/plugin-app-backend';
import authGithubModule from '@backstage/plugin-auth-backend-module-github-provider';
import authPlugin from '@backstage/plugin-auth-backend';
import catalogPlugin from '@backstage/plugin-catalog-backend';
import proxyPlugin from '@backstage/plugin-proxy-backend';
import scaffolderPlugin from '@backstage/plugin-scaffolder-backend';
import techdocsPluginAlpha from '@backstage/plugin-techdocs-backend';
import { CustomKindsModule } from './modules/catalog-schema-extensions';
import { globalWiremockInterceptorModule } from './modules/wiremock-interceptor';
import { PermissionModule } from './modules/test-permission-policy';
import { wiremockBootstrapperModule } from './modules/wiremock-bootstrapper';

export async function startDevBackend() {
  const backend = createBackend();

  // 1. Add your standard org infrastructure (Auth, Catalog defaults, etc.)
  // backend.add(import('@backstage/plugin-auth-backend'));

  // 2. Dynamically resolve the plugin running this command
  const pluginRoot = process.cwd();
  const pluginSrcPath = path.resolve(pluginRoot, 'src/index.ts');

  try {
    // Override the default configuration service parameters
    /*
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
    */

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

    // Dynamically pull in the plugin's backend module
    // note: requires a ts-node or tsx runner at runtime to parse .ts directly
    const pluginModule = await import(pluginSrcPath);

    // If your plugins export a standard default backend feature/plugin
    if (pluginModule.default) {
      backend.add(pluginModule.default);
      console.log(`Successfully injected plugin from ${pluginSrcPath}`);
    } else {
      console.warn(`Plugin at ${pluginSrcPath} did not provide a default export.`);
    }

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
    backend.add(CustomKindsModule);
    backend.add(globalWiremockInterceptorModule);
    backend.add(wiremockBootstrapperModule);
  } catch (error) {
    console.error(`Failed to dynamically load plugin at ${pluginSrcPath}:`, error);
    process.exit(1);
  }

  await backend.start();
}
