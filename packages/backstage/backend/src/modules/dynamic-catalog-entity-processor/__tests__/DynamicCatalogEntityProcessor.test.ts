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
import { catalogModuleDynamicEntities, DynamicFixtureEntityProvider } from '../DynamicCatalogEntityProcessor';
import { getProgrammaticEntities } from '@ai-crew-suite/fixtures-catalog';
import { getProgrammaticTemplates } from '@ai-crew-suite/fixtures-scaffolder';

vi.mock('@ai-crew-suite/fixtures-catalog', () => ({
  getProgrammaticEntities: vi.fn(),
}));

vi.mock('@ai-crew-suite/fixtures-scaffolder', () => ({
  getProgrammaticTemplates: vi.fn(),
}));

describe('catalogModuleDynamicEntities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully register the provider inside the catalog extension point framework', async () => {
    const mockCatalogProcessing = {
      addEntityProvider: vi.fn(),
      addProcessor: vi.fn(),
    };

    await startTestBackend({
      features: [catalogModuleDynamicEntities],
      extensionPoints: [
        [catalogProcessingExtensionPoint, mockCatalogProcessing],
      ],
    });

    // 3. Verify execution context
    expect(mockCatalogProcessing.addEntityProvider).toHaveBeenCalledTimes(1);
    expect(mockCatalogProcessing.addEntityProvider).toHaveBeenCalledWith(
      expect.any(DynamicFixtureEntityProvider)
    );
  });

  it('should skip provider registration when both fixture groups are disabled via configuration', async () => {
    const mockCatalogProcessing = {
      addEntityProvider: vi.fn(),
      addProcessor: vi.fn(),
    };

    await startTestBackend({
      features: [
        catalogModuleDynamicEntities,
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

    expect(mockCatalogProcessing.addEntityProvider).not.toHaveBeenCalled();
  });

  it('should still register the provider when only the catalog entities are disabled', async () => {
    const mockCatalogProcessing = {
      addEntityProvider: vi.fn(),
      addProcessor: vi.fn(),
    };

    await startTestBackend({
      features: [
        catalogModuleDynamicEntities,
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
  });

  it('should still register the provider when only the scaffolder templates are disabled', async () => {
    const mockCatalogProcessing = {
      addEntityProvider: vi.fn(),
      addProcessor: vi.fn(),
    };

    await startTestBackend({
      features: [
        catalogModuleDynamicEntities,
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
  });
});

describe('DynamicFixtureEntityProvider', () => {
  let mockConnection: any;

  const mockCatalogEntity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'micro-service-a',
      annotations: {
        'custom-annotation': 'active-profile',
      },
    },
    spec: { type: 'service', owner: 'guest' },
  };

  const mockTemplateEntity = {
    apiVersion: 'scaffolder.backstage.io/v1beta3',
    kind: 'Template',
    metadata: {
      name: 'offline-hello-world',
    },
    spec: {
      type: 'service',
      owner: 'platform-team',
      steps: [{ id: 'log', name: 'Log', action: 'debug:log' }],
      output: { text: [{ content: 'done' }] },
    },
  };

  const mockCatalogEntities = [mockCatalogEntity];
  const mockTemplateEntities = [mockTemplateEntity];

  beforeEach(() => {
    vi.clearAllMocks();
    mockConnection = {
      applyMutation: vi.fn().mockResolvedValue(undefined),
    };

    // Force mock data return arrays
    vi.mocked(getProgrammaticEntities).mockReturnValue(mockCatalogEntities as any);
    vi.mocked(getProgrammaticTemplates).mockReturnValue(mockTemplateEntities as any);
  });

  it('should resolve the correct catalog indexing identification keys', () => {
    const provider = new DynamicFixtureEntityProvider();
    expect(provider.getProviderName()).toBe('DynamicFixtureEntityProvider');
  });

  it('should extract programmatic entities, append annotations, and push a full mutation on connect', async () => {
    const provider = new DynamicFixtureEntityProvider();

    // Triggering the connect routine forces internal mutation execution instantly
    await provider.connect(mockConnection);

    expect(getProgrammaticEntities).toHaveBeenCalledTimes(1);
    expect(getProgrammaticTemplates).toHaveBeenCalledTimes(1);
    expect(mockConnection.applyMutation).toHaveBeenCalledTimes(1);

    expect(mockConnection.applyMutation).toHaveBeenCalledWith({
      type: 'full',
      entities: [
        {
          locationKey: 'dynamic-fixture-provider:component:micro-service-a',
          entity: {
            apiVersion: 'backstage.io/v1alpha1',
            kind: 'Component',
            spec: { type: 'service', owner: 'guest' },
            metadata: {
              name: 'micro-service-a',
              annotations: {
                'custom-annotation': 'active-profile',
                'backstage.io/managed-by-location': 'external:DynamicFixtureEntityProvider',
                'backstage.io/managed-by-origin-location': 'external:DynamicFixtureEntityProvider',
              },
            },
          },
        },
        {
          locationKey: 'dynamic-fixture-provider:template:offline-hello-world',
          entity: {
            apiVersion: 'scaffolder.backstage.io/v1beta3',
            kind: 'Template',
            spec: mockTemplateEntity.spec,
            metadata: {
              name: 'offline-hello-world',
              annotations: {
                'backstage.io/managed-by-location': 'external:DynamicFixtureEntityProvider',
                'backstage.io/managed-by-origin-location': 'external:DynamicFixtureEntityProvider',
              },
            },
          },
        },
      ],
    });
  });

  it('should exclude scaffolder templates from the mutation when includeScaffolderTemplates is false', async () => {
    const provider = new DynamicFixtureEntityProvider({
      includeScaffolderTemplates: false,
    });

    await provider.connect(mockConnection);

    expect(getProgrammaticEntities).toHaveBeenCalledTimes(1);
    expect(getProgrammaticTemplates).not.toHaveBeenCalled();
    expect(mockConnection.applyMutation).toHaveBeenCalledTimes(1);

    const mutation = mockConnection.applyMutation.mock.calls[0][0];
    expect(mutation.type).toBe('full');
    expect(mutation.entities).toHaveLength(1);
    expect(mutation.entities[0].entity.kind).toBe('Component');
  });

  it('should exclude catalog entities from the mutation when includeCatalogEntities is false', async () => {
    const provider = new DynamicFixtureEntityProvider({
      includeCatalogEntities: false,
    });

    await provider.connect(mockConnection);

    expect(getProgrammaticEntities).not.toHaveBeenCalled();
    expect(getProgrammaticTemplates).toHaveBeenCalledTimes(1);
    expect(mockConnection.applyMutation).toHaveBeenCalledTimes(1);

    const mutation = mockConnection.applyMutation.mock.calls[0][0];
    expect(mutation.type).toBe('full');
    expect(mutation.entities).toHaveLength(1);
    expect(mutation.entities[0].entity.kind).toBe('Template');
  });

  it('should gracefully bail out on refresh calls if connection framework has not loaded yet', async () => {
    const provider = new DynamicFixtureEntityProvider();
    // Intentionally calling refresh prior to executing connect loop bounds
    await expect(provider.refreshEntities()).resolves.not.toThrow();
    expect(mockConnection.applyMutation).not.toHaveBeenCalled();
  });
});
