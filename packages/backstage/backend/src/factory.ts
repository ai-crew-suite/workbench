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
import path from 'path';
import { createBackend } from '@backstage/backend-defaults';
import { DatabaseManager } from '@backstage/backend-defaults/database';
import { createServiceFactory, coreServices } from '@backstage/backend-plugin-api';
//import { rootConfigServiceFactory } from '@backstage/backend-defaults/rootConfig';
import authGithubModule from '@backstage/plugin-auth-backend-module-github-provider';
import authPlugin from '@backstage/plugin-auth-backend';
import catalogPlugin from '@backstage/plugin-catalog-backend';
import eventsPlugin from '@backstage/plugin-events-backend';
import notificationsPlugin from '@backstage/plugin-notifications-backend';
import permissionsPlugin from '@backstage/plugin-permission-backend';
import proxyPlugin from '@backstage/plugin-proxy-backend';
import scaffolderPlugin from '@backstage/plugin-scaffolder-backend';
import searchCatalogCollatorPlugin from '@backstage/plugin-search-backend-module-catalog';
import searchPlugin from '@backstage/plugin-search-backend';
import signalsPlugin from '@backstage/plugin-signals-backend';
import techdocsPluginAlpha from '@backstage/plugin-techdocs-backend';
import { CustomKindsModule } from './modules/catalog-schema-extensions';
import { testPermissionModule } from './modules/test-permission-policy';
import { globalWiremockInterceptorModule } from './modules/wiremock-interceptor';
import { wiremockBootstrapperModule } from './modules/wiremock-bootstrapper';

/**
 * A standardized service factory override that explicitly configures Knex
 * to leverage better-sqlite3 for local in-memory execution states.
 */
const customDatabaseServiceFactory = createServiceFactory({
  service: coreServices.database,
  deps: {
    config: coreServices.rootConfig,
    rootLogger: coreServices.rootLogger,
    rootLifecycle: coreServices.rootLifecycle,
    logger: coreServices.logger,
    lifecycle: coreServices.lifecycle,
    pluginMetadata: coreServices.pluginMetadata,
  },
  createRootContext: async ({ config, rootLogger, rootLifecycle }) => {
    return DatabaseManager.fromConfig(config, { rootLogger, rootLifecycle });
  },
  async factory({ logger, lifecycle, pluginMetadata }, manager) {
    return manager.forPlugin(pluginMetadata.getId(), { logger, lifecycle });
  },
});

/**
 * Global Dev Sandbox Authentication Bypass
 */
const devSandboxHttpAuthServiceFactory = createServiceFactory({
  service: coreServices.httpAuth,
  deps: {},
  async factory() {
    return {
      async credentials(_ctx: unknown, _options: unknown) {
        return {
          type: 'user',
          principal: {
            type: 'user',
            userEntityRef: 'user:default/guest',
            ownershipEntityRefs: ['user:default/guest', 'group:default/developers'],
          },
        };
      },
      isPrincipal(credentials: unknown, principalType: unknown) {
        return (credentials as any)?.type === principalType;
      },
    } as any;
  },
});

/**
 * Global User Info Mock Bypass
 */
const devSandboxUserInfoServiceFactory = createServiceFactory({
  service: coreServices.userInfo,
  deps: {},
  async factory() {
    return {
      async getUserInfo(_credentials) {
        return {
          userEntityRef: 'user:default/guest',
          ownershipEntityRefs: ['user:default/guest', 'group:default/developers'],
          metadata: {
            displayName: 'Dev Guest User',
            email: 'developer@ai-crew-suite.local',
          },
        };
      },
    };
  },
});

/**
 * Global Dev Sandbox Auth Service Bypass
 *
 * Companion to {@link devSandboxHttpAuthServiceFactory}: the sandbox guest
 * credentials minted by the HTTP auth mock carry no signed token, so the real
 * core auth service rejects them in `getPluginRequestToken` (used by e.g. the
 * search backend's /query route). This mock issues static tokens instead and
 * hands out properly shaped internal credentials elsewhere.
 */
const devSandboxAuthServiceFactory = createServiceFactory({
  service: coreServices.auth,
  deps: {},
  async factory() {
    const serviceCredentials = {
      $$type: '@backstage/BackstageCredentials',
      version: 'v1',
      principal: { type: 'service', subject: 'dev-sandbox' },
    };
    const guestUserCredentials = {
      $$type: '@backstage/BackstageCredentials',
      version: 'v1',
      principal: {
        type: 'user',
        userEntityRef: 'user:default/guest',
        ownershipEntityRefs: ['user:default/guest', 'group:default/developers'],
      },
    };
    return {
      async authenticate(_token: string) {
        return guestUserCredentials;
      },
      async isPrincipal(credentials: unknown, principalType: string) {
        return (credentials as any)?.principal?.type === principalType;
      },
      async getNoneCredentials() {
        return {
          $$type: '@backstage/BackstageCredentials',
          version: 'v1',
          principal: { type: 'none' },
        };
      },
      async getOwnServiceCredentials() {
        return serviceCredentials;
      },
      async getPluginRequestToken(_options: unknown) {
        return { token: 'dev-sandbox-plugin-token' };
      },
      async getLimitedUserToken(_credentials: unknown) {
        return {
          token: 'dev-sandbox-limited-user-token',
          expiresAt: new Date(Date.now() + 3_600_000),
        };
      },
      async listPublicServiceKeys() {
        return { keys: [] };
      },
    } as any;
  },
});

export async function startDevBackend() {
  const backend = createBackend();

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

  // Enforce core service overrides
  backend.add(customDatabaseServiceFactory);
  backend.add(devSandboxHttpAuthServiceFactory);
  backend.add(devSandboxUserInfoServiceFactory);
  backend.add(devSandboxAuthServiceFactory);

  // Standard core system plugins (Guaranteed to boot safely)
  backend.add(proxyPlugin);
  backend.add(catalogPlugin);
  backend.add(techdocsPluginAlpha);
  backend.add(scaffolderPlugin);

  // Serves the /api/search/query endpoint used by the frontend search page,
  // with the catalog collator indexing mock-fixture entities into the index.
  backend.add(searchPlugin);
  backend.add(searchCatalogCollatorPlugin);

  // Attach authentication and event systems natively
  backend.add(authPlugin);
  backend.add(authGithubModule);
  backend.add(signalsPlugin);
  backend.add(notificationsPlugin);

  // Inject test sandboxing modules
  backend.add(eventsPlugin);
  backend.add(permissionsPlugin);
  backend.add(testPermissionModule);
  backend.add(CustomKindsModule);
  backend.add(globalWiremockInterceptorModule);
  backend.add(wiremockBootstrapperModule);

  // ISOLATED SANDBOX INJECTION: Protect the orchestrator core from consumer failures
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
    // Let it drop through or keep going so you can at least see diagnostics logs
  }

  // Fire up the engine container thread
  await backend.start();
}
