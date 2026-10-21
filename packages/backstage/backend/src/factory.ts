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
import {
  BackendFeature,
  createBackendModule,
  coreServices,
} from '@backstage/backend-plugin-api';
import { PermissionPolicy } from '@backstage/plugin-permission-node';
import { policyExtensionPoint } from '@backstage/plugin-permission-node/alpha';

// Core Plugins
import authPlugin from '@backstage/plugin-auth-backend';
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
import searchTechDocsCollatorPlugin from '@backstage/plugin-search-backend-module-techdocs';
import signalsPlugin from '@backstage/plugin-signals-backend';
import techdocsPluginAlpha from '@backstage/plugin-techdocs-backend';

// Local Custom Extension Modules
import { CustomKindsModule } from './modules/catalog-schema-extensions';
import { catalogOptionalLocalFixturesModule } from './modules/catalog-optional-fixtures-processor';
import { catalogModuleDynamicEntities } from './modules/dynamic-catalog-entity-processor';
import { catalogModuleFixtureAnnotations } from './modules/dynamic-annotation-processor';
import { TestPermissionPolicy } from './modules/test-permission-policy';
import { wiremockBootstrapperModule } from './modules/wiremock-bootstrapper';
import { globalWiremockInterceptorModule } from './modules/wiremock-interceptor';

// Clean Service Factory Extracts
import { customDatabaseServiceFactory } from './services/database';
import { devSandboxAuthServices } from './services/auth';
import { mockConfigServiceFactory } from './services/config';

export interface DevBackendOptions {
  /** Additional features, plugins, or modules from clients to wire into the dev backend */
  features?: BackendFeature | BackendFeature[];
  /** An optional custom permission policy instance to override the default TestPermissionPolicy */
  customPolicy?: PermissionPolicy;
}

export async function startDevBackend(options: DevBackendOptions = {}) {
  const backend = createBackend();

  // 1. Configuration **Must Be Added First**
  backend.add(mockConfigServiceFactory);

  // 2. Add Database and Authentication Service Overrides
  backend.add(customDatabaseServiceFactory);
  devSandboxAuthServices.forEach(service => backend.add(service));

  // 3. Standard Core System Plugins
  backend.add(proxyPlugin);
  backend.add(catalogPlugin);
  backend.add(catalogModuleLogs);
  backend.add(catalogModuleScaffolderEntityModel);
  backend.add(kubernetesPlugin);
  backend.add(techdocsPluginAlpha);
  backend.add(scaffolderPlugin);
  backend.add(searchPlugin);
  backend.add(searchCatalogCollatorPlugin);
  backend.add(searchTechDocsCollatorPlugin);

  // 4. Telemetry, Auth, and Notification Ingestion Systems
  backend.add(authPlugin);
  backend.add(signalsPlugin);
  backend.add(notificationsPlugin);
  backend.add(eventsPlugin);
  backend.add(permissionsPlugin);

  // 5. Set the client-provided permission policy or fall back to TestPermissionPolicy
  backend.add(
    createBackendModule({
      pluginId: 'permission',
      moduleId: 'custom-policy',
      register(reg) {
        reg.registerInit({
          deps: {
            policy: policyExtensionPoint,
            logger: coreServices.logger,
          },
          async init({ policy, logger }) {
            if (options.customPolicy) {
              // Log clearly using both the dev console and the formal Backstage Logger Service
              console.log(`\x1b[36m[Dev-Backend] OVERRIDE: Injecting client-provided custom permission policy: ${options.customPolicy.constructor.name}\x1b[0m`);
              logger.info(`Injecting client-provided custom permission policy override: ${options.customPolicy.constructor.name}`);

              policy.setPolicy(options.customPolicy);
            } else {
              console.log(`[Dev-Backend] System using default fallback sandbox authorization policy (TestPermissionPolicy).`);
              logger.info('Initializing default dev environment authorization safety policy: TestPermissionPolicy');

              // Fall back to the original unmodified TestPermissionPolicy class definition
              policy.setPolicy(new TestPermissionPolicy());
            }
          },
        });
      },
    })
  );

  // 6. Custom Internal Enterprise Sandboxing Modules
  backend.add(CustomKindsModule);
  backend.add(globalWiremockInterceptorModule);
  backend.add(wiremockBootstrapperModule);

  // 7. Ingest Central Programmatic Seeders (Entities and Annotations)
  backend.add(catalogModuleDynamicEntities);
  backend.add(catalogModuleFixtureAnnotations);
  backend.add(catalogOptionalLocalFixturesModule);

  // 8. Local Plugin Attachment
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

  // Normalize features to a flat array
  const featuresToRegister = options.features
    ? (Array.isArray(options.features) ? options.features : [options.features])
    : [];

  // Safely register client-provided custom features with exact error attribution
  for (const feature of featuresToRegister) {
    // Basic structural validation before executing Backstage engine code
    if (!feature || typeof feature !== 'object') {
      throw new TypeError(
        `[DevBackend] Failed to add feature: Expected a valid BackendFeature object, but received ${typeof feature}.`
      );
    }

    try {
      backend.add(feature);
    } catch (error: any) {
      // Catch misconfigured plugins during the registration hook phase
      throw new Error(
        `[DevBackend] Encountered a critical error while adding feature. ` +
        `Ensure its feature ID or dependency setup is valid.\n` +
        `Original Error: ${error?.message || error}`
      );
    }
  }

  // 9. Fire up the engine container thread
  try {
    await backend.start();
  } catch (error: any) {
    // Catch lifecycle initialization/dependency graph failures
    throw new Error(
      `[DevBackend] Backend server failed to start during dependency initialization lifecycle.\n` +
      `Root Cause: ${error?.message || error}`
    );
  }
}
