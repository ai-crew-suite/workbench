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
import { startTestBackend } from '@backstage/backend-test-utils';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node';
import { catalogModuleDynamicEntities, DynamicFixtureEntityProvider } from '../DynamicCatalogEntityProcessor';
import { getProgrammaticEntities } from '@ai-crew-suite/fixtures-catalog';

vi.mock('@ai-crew-suite/fixtures-catalog', () => ({
  getProgrammaticEntities: vi.fn(),
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
});

describe('DynamicFixtureEntityProvider', () => {
  let mockConnection: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConnection = {
      applyMutation: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('should resolve the correct catalog indexing identification keys', () => {
    const provider = new DynamicFixtureEntityProvider();
    expect(provider.getProviderName()).toBe('DynamicFixtureEntityProvider');
  });

  it('should extract programmatic entities, append annotations, and push a full mutation on connect', async () => {
    const mockEntities = [
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'micro-service-a',
          annotations: {
            'custom-annotation': 'active-profile',
          },
        },
        spec: { type: 'service', owner: 'guest' },
      },
    ];

    // Force mock data return array
    vi.mocked(getProgrammaticEntities).mockReturnValue(mockEntities as any);

    const provider = new DynamicFixtureEntityProvider();

    // Triggering the connect routine forces internal mutation execution instantly
    await provider.connect(mockConnection);

    expect(getProgrammaticEntities).toHaveBeenCalledTimes(1);
    expect(mockConnection.applyMutation).toHaveBeenCalledTimes(1);

    expect(mockConnection.applyMutation).toHaveBeenCalledWith({
      type: 'full',
      entities: [
        {
          locationKey: 'dynamic-fixture-provider:micro-service-a',
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
      ],
    });
  });

  it('should gracefully bail out on refresh calls if connection framework has not loaded yet', async () => {
    const provider = new DynamicFixtureEntityProvider();
    // Intentionally calling refresh prior to executing connect loop bounds
    await expect(provider.refreshEntities()).resolves.not.toThrow();
    expect(mockConnection.applyMutation).not.toHaveBeenCalled();
  });
});
