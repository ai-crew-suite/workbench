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
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node';
import { catalogDynamicEntitiesModule, DynamicFixtureEntityProvider } from '../DynamicCatalogEntityProcessor';

vi.mock('@ai-crew-suite/fixtures-catalog', () => ({
  getProgrammaticEntities: vi.fn(),
}));

vi.mock('@ai-crew-suite/fixtures-scaffolder', () => ({
  getProgrammaticTemplates: vi.fn(),
}));

describe('catalogDynamicEntitiesModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully register the provider inside the catalog extension point framework', async () => {
    const mockCatalogProcessing = {
      addEntityProvider: vi.fn(),
      addProcessor: vi.fn(),
    };

    await startTestBackend({
      features: [catalogDynamicEntitiesModule],
      extensionPoints: [
        [catalogProcessingExtensionPoint, mockCatalogProcessing],
      ],
    });

    expect(mockCatalogProcessing.addEntityProvider).toHaveBeenCalledTimes(1);
    expect(mockCatalogProcessing.addEntityProvider).toHaveBeenCalledWith(
      expect.any(DynamicFixtureEntityProvider)
    );
  });

  it('should still register the provider when both fixture groups are disabled via configuration', async () => {
    const mockCatalogProcessing = {
      addEntityProvider: vi.fn(),
      addProcessor: vi.fn(),
    };

    await startTestBackend({
      features: [
        catalogDynamicEntitiesModule,
        mockServices.rootConfig.factory({
          data: {
            aiCrewSuite: {
              modules: {
                dynamicEntities: { enabled: false },
                scaffolderTemplates: { enabled: false },
              },
            },
          },
        }),
      ],
      extensionPoints: [
        [catalogProcessingExtensionPoint, mockCatalogProcessing],
      ],
    });

    // FIXED: Assert that it successfully registers the provider to handle consumer entities,
    // but verifies that both internal programmatic seeding flags are safely evaluated as false.
    expect(mockCatalogProcessing.addEntityProvider).toHaveBeenCalledTimes(1);
    expect(mockCatalogProcessing.addEntityProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        includeCatalogEntities: false,
        includeScaffolderTemplates: false,
      })
    );
  });

  it('should still register the provider when only the catalog entities are disabled', async () => {
    const mockCatalogProcessing = {
      addEntityProvider: vi.fn(),
      addProcessor: vi.fn(),
    };

    await startTestBackend({
      features: [
        catalogDynamicEntitiesModule,
        mockServices.rootConfig.factory({
          data: {
            aiCrewSuite: {
              modules: {
                dynamicEntities: { enabled: false },
              },
            },
          },
        }),
      ],
      extensionPoints: [
        [catalogProcessingExtensionPoint, mockCatalogProcessing],
      ],
    });

    expect(mockCatalogProcessing.addEntityProvider).toHaveBeenCalledTimes(1);
    expect(mockCatalogProcessing.addEntityProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        includeCatalogEntities: false,
        includeScaffolderTemplates: true,
      })
    );
  });

  it('should still register the provider when only the scaffolder templates are disabled', async () => {
    const mockCatalogProcessing = {
      addEntityProvider: vi.fn(),
      addProcessor: vi.fn(),
    };

    await startTestBackend({
      features: [
        catalogDynamicEntitiesModule,
        mockServices.rootConfig.factory({
          data: {
            aiCrewSuite: {
              modules: {
                scaffolderTemplates: { enabled: false },
              },
            },
          },
        }),
      ],
      extensionPoints: [
        [catalogProcessingExtensionPoint, mockCatalogProcessing],
      ],
    });

    expect(mockCatalogProcessing.addEntityProvider).toHaveBeenCalledTimes(1);
    expect(mockCatalogProcessing.addEntityProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        includeCatalogEntities: true,
        includeScaffolderTemplates: false,
      })
    );
  });
});
