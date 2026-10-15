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
import { DatabaseManager } from '@backstage/backend-defaults/database';

/**
 * A standardized service factory override that explicitly configures Knex
 * to leverage better-sqlite3 for local in-memory execution states.
 */
export const customDatabaseServiceFactory = createServiceFactory({
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
