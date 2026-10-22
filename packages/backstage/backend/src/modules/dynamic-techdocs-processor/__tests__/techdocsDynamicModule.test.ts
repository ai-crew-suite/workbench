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
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { mockServices, startTestBackend } from '@backstage/backend-test-utils';
import { techdocsDynamicModule } from '../techdocsDynamicModule';

// Mock the fixtures package directory provider to insulate tests from filesystem variations
vi.mock('@ai-crew-suite/fixtures-techdocs', () => ({
  getProgrammaticTechDocsPath: () => '/mocked/node_modules/static-compiled',
}));

describe('techdocsDynamicModule Framework Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully pass both middleware instances to the router registry when enabled', async () => {
    const httpRouterMock = mockServices.httpRouter.mock();

    // Spy directly onto the internal routing engine's use block
    const useSpy = vi.spyOn(httpRouterMock, 'use');

    await startTestBackend({
      features: [
        techdocsDynamicModule,
        // Pass the router factory instance token directly without invoking call signatures
        httpRouterMock.factory,
      ],
    });

    // Verifies that it calls .use() 2 times: Layer 1 (default fixtures) and Layer 2 (client overrides)
    expect(useSpy).toHaveBeenCalledTimes(2);
    expect(useSpy).toHaveBeenNthCalledWith(1, expect.any(Function));
    expect(useSpy).toHaveBeenNthCalledWith(2, expect.any(Function));
  });

  it('should only register the client dev/techdocs middleware layer when techdocsFixtures is disabled', async () => {
    const httpRouterMock = mockServices.httpRouter.mock();
    const useSpy = vi.spyOn(httpRouterMock, 'use');

    await startTestBackend({
      features: [
        techdocsDynamicModule,
        httpRouterMock.factory,
        mockServices.rootConfig.factory({
          data: {
            aiCrewSuite: {
              modules: {
                techdocsFixtures: { enabled: false },
              },
            },
          },
        }),
      ],
    });

    // FIXED: Verifies that it skips Layer 1 but still registers Layer 2 (client dev/techdocs fallback)
    expect(useSpy).toHaveBeenCalledTimes(1);
    expect(useSpy).toHaveBeenCalledWith(expect.any(Function));
  });
});
