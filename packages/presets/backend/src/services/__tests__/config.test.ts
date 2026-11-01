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
import { coreServices, createBackendPlugin } from '@backstage/backend-plugin-api';
import { startTestBackend } from '@backstage/backend-test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockConfigServiceFactory } from '../config';

describe('backend database configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    [undefined, 15432],
    ['25432', 25432],
  ])('uses host PostgreSQL port %s as %i', async (port, expected) => {
    vi.stubEnv('POSTGRES_PORT', port);
    vi.stubEnv('APP_CONFIG', '[]');
    let actualPort: number | undefined;
    const plugin = createBackendPlugin({
      pluginId: 'config-test',
      register(env) {
        env.registerInit({
          deps: { config: coreServices.rootConfig },
          async init({ config }) {
            actualPort = config.getNumber('backend.database.connection.port');
          },
        });
      },
    });

    await startTestBackend({ features: [mockConfigServiceFactory, plugin] });
    expect(actualPort).toBe(expected);
  });
});
