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
import { createBackendModule, coreServices, HttpRouterService } from '@backstage/backend-plugin-api';
import { getProgrammaticTechDocsPath } from '@ai-crew-suite/fixtures-techdocs';
import express from 'express';
import path from 'path';

/**
 * Options controlling which programmatic TechDocs fixture sets are loaded.
 */
export interface TechDocsDynamicSeederOptions {
  /** Whether to mount the default mock fixtures from `@ai-crew-suite/fixtures-techdocs`. */
  includeDefaultFixtures?: boolean;
}

/**
 * Custom infrastructure class responsible for seeding and serving mock
 * TechDocs documentation assets within sandbox dev environments.
 */
export class TechDocsDynamicSeeder {
  private readonly includeDefaultFixtures: boolean;

  constructor(options: TechDocsDynamicSeederOptions = {}) {
    this.includeDefaultFixtures = options.includeDefaultFixtures ?? true;
  }

  /**
   * Mounts the compiled documentation assets onto the core platform router middleware.
   */
  public async seed(httpRouter: HttpRouterService): Promise<void> {
    try {
      // 1. LAYER ONE: Check and load default platform fixtures if enabled
      if (this.includeDefaultFixtures) {
        const staticAssetsPath = getProgrammaticTechDocsPath();

        const defaultMiddleware = express.static(staticAssetsPath, {
          fallthrough: true, // Allows routing to cascade to layer two if file is missing here
          setHeaders: (res) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
          }
        });

        httpRouter.use(defaultMiddleware);
      }

      // 2. LAYER TWO: Automatically map client-level 'dev/techdocs' directory for overrides
      const clientLocalDevDocs = path.resolve(process.cwd(), 'dev/techdocs');

      const clientMiddleware = express.static(clientLocalDevDocs, {
        fallthrough: true, // Gracefully cascades down to standard platform handlers if missing
        setHeaders: (res) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
        }
      });

      httpRouter.use(clientMiddleware);

    } catch (error) {
      throw new Error(`[TechDocs-Sandbox] Critical failure inside asset seeder execution loop: ${error}`);
    }
  }
}

/**
 * Central system backend module registry connecting our asset seeder class to the core TechDocs framework.
 */
export const techdocsDynamicModule = createBackendModule({
  pluginId: 'techdocs',
  moduleId: 'sandbox-asset-seeder',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        httpRouter: coreServices.httpRouter,
      },
      async init({ config, httpRouter }) {
        const defaultFixturesEnabled = config.getOptionalBoolean('aiCrewSuite.modules.techdocsFixtures.enabled') ?? true;

        const seeder = new TechDocsDynamicSeeder({
          includeDefaultFixtures: defaultFixturesEnabled,
        });

        await seeder.seed(httpRouter);
      },
    });
  },
});
