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
import path from 'path';
import { createBackend } from '@backstage/backend-defaults';

// Core Plugins
import authPlugin from '@backstage/plugin-auth-backend';
import authGithubModule from '@backstage/plugin-auth-backend-module-github-provider';
import catalogPlugin from '@backstage/plugin-catalog-backend';
import catalogModuleLogs from '@backstage/plugin-catalog-backend-module-logs';
import catalogModuleScaffolderEntityModel from '@backstage/plugin-catalog-backend-module-scaffolder-entity-model';
import eventsPlugin from '@backstage/plugin-events-backend';
import kubernetesPlugin from '@backstage/plugin-kubernetes-backend';
import notificationsPlugin from '@backstage/plugin-notifications-backend';
import permissionsPlugin from '@backstage/plugin-permission-backend';
import proxyPlugin from '@backstage/plugin-proxy-backend';
import scaffolderPlugin from '@backstage/plugin-scaffolder-backend';
import searchPlugin from '@backstage/plugin-search-backend';
import searchCatalogCollatorPlugin from '@backstage/plugin-search-backend-module-catalog';
import signalsPlugin from '@backstage/plugin-signals-backend';
import techdocsPluginAlpha from '@backstage/plugin-techdocs-backend';

// Local Custom Extension Modules
import { catalogModuleDynamicEntities } from './modules/dynamic-catalog-entity-processor';
import { catalogModuleFixtureAnnotations } from './modules/dynamic-annotation-processor';
import { CustomKindsModule } from './modules/catalog-schema-extensions';
import { catalogOptionalLocalFixturesModule } from './modules/catalog-optional-fixtures-processor';
import { globalWiremockInterceptorModule } from './modules/wiremock-interceptor';
import { testPermissionModule } from './modules/test-permission-policy';
import { wiremockBootstrapperModule } from './modules/wiremock-bootstrapper';

// Clean Service Factory Extracts
import { customDatabaseServiceFactory } from './services/database';
import { devSandboxAuthServices } from './services/auth';
import { mockConfigServiceFactory } from './services/config';

export async function startDevBackend() {
  const backend = createBackend();

  // 1. Add Configuration Infrastructure and Core Service Overrides
  backend.add(mockConfigServiceFactory);
  backend.add(customDatabaseServiceFactory);
  devSandboxAuthServices.forEach(service => backend.add(service));

  // 2. Standard Core System Plugins
  backend.add(proxyPlugin);
  backend.add(catalogPlugin);
  backend.add(catalogModuleLogs);
  backend.add(catalogModuleScaffolderEntityModel);
  backend.add(kubernetesPlugin);
  backend.add(techdocsPluginAlpha);
  backend.add(scaffolderPlugin);
  backend.add(searchPlugin);
  backend.add(searchCatalogCollatorPlugin);

  // 3. Telemetry, Auth, and Notification Ingestion Systems
  backend.add(authPlugin);
  backend.add(authGithubModule);
  backend.add(signalsPlugin);
  backend.add(notificationsPlugin);
  backend.add(eventsPlugin);
  backend.add(permissionsPlugin);

  // 4. Custom Internal Enterprise Sandboxing Modules
  backend.add(testPermissionModule);
  backend.add(CustomKindsModule);
  backend.add(globalWiremockInterceptorModule);
  backend.add(wiremockBootstrapperModule);

  // 5. Ingest Central Programmatic Seeders (Entities and Annotations)
  backend.add(catalogModuleDynamicEntities);
  backend.add(catalogModuleFixtureAnnotations);
  backend.add(catalogOptionalLocalFixturesModule);

  // 6. ISOLATED SANDBOX INJECTION: Dynamic Local Plugin Attachment
  const pluginRoot = process.cwd();
  const pluginSrcPath = path.resolve(pluginRoot, 'src/index.ts');

  try {
    console.log(`[Dev-Backend] Attempting dynamic connection to target plugin at: ${pluginSrcPath}`);
    const pluginModule = await import(pluginSrcPath);

    if (pluginModule.default) {
      backend.add(pluginModule.default);
      console.log(`[Dev-Backend] Successfully injected plugin from ${pluginSrcPath}`);
    } else {
      console.warn(`[Dev-Backend] Warning: Plugin at ${pluginSrcPath} did not provide a default export.`);
    }
  } catch (error) {
    console.error(`[Dev-Backend] CRITICAL ERROR: Failed to dynamically load target plugin at ${pluginSrcPath}.`);
    console.error(error);
  }

  // Fire up the engine container thread
  await backend.start();
}
