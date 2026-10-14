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
import {
  createBackendPlugin,
  coreServices
} from '@backstage/backend-plugin-api';
import express from 'express';

/**
 * A minimal "Hello World" Backstage backend plugin to verify our local dev package
 * orchestrator. Following official standards, it is re-exported as the DEFAULT export.
 * Available at `/api/hello-world/health` for health checks.
 */
export default createBackendPlugin({
  pluginId: 'hello-world',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
      },
      async init({ httpRouter, logger }) {
        logger.info('Initializing the Hello World testpad plugin...');

        const router = express.Router();

        router.get('/health', (_req: express.Request, res: express.Response) => {
          res.json({
            status: 'ok',
            message: 'Hello from your isolated testpad-backend plugin!',
            timestamp: new Date().toISOString()
          });
        });

        httpRouter.use(router);

        logger.info('Hello World testpad plugin successfully registered and listening!');
      },
    });
  },
});
