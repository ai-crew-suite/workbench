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
import { catalogDynamicAnnotationsModule } from '../DynamicAnnotationProcessor';
import { Entity } from '@backstage/catalog-model';

vi.mock('@ai-crew-suite/fixtures-annotations', () => ({
  annotationsFixtureRegistry: [
    {
      targetEntityRef: 'component:default/platform',
      factory: (entity: Entity) => ({
        'mock.io/injected-annotation': `active-${entity.metadata.name}`,
      }),
    },
    {
      targetEntityRef: 'invalid-entity-ref-format-garbage!', // Test resilience to bad refs
      factory: () => ({}),
    },
  ],
}));

describe('catalogDynamicAnnotationsModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully register the processor inside the catalog container pipeline', async () => {
    const mockCatalogProcessing = {
      addEntityProvider: vi.fn(),
      addProcessor: vi.fn(),
    };

    await startTestBackend({
      features: [catalogDynamicAnnotationsModule],
      extensionPoints: [
        [catalogProcessingExtensionPoint, mockCatalogProcessing],
      ],
    });

    expect(mockCatalogProcessing.addProcessor).toHaveBeenCalledTimes(1);
    expect(mockCatalogProcessing.addProcessor).toHaveBeenCalledWith(
      expect.objectContaining({
        getProcessorName: expect.any(Function),
      })
    );
  });

  it('should still register the processor when default fixtures are disabled', async () => {
    const mockCatalogProcessing = {
      addEntityProvider: vi.fn(),
      addProcessor: vi.fn(),
    };

    await startTestBackend({
      features: [
        catalogDynamicAnnotationsModule,
        mockServices.rootConfig.factory({
          data: {
            aiCrewSuite: {
              modules: {
                fixtureAnnotations: { enabled: false },
              },
            },
          },
        }),
      ],
      extensionPoints: [
        [catalogProcessingExtensionPoint, mockCatalogProcessing],
      ],
    });

    // FIXED: Asserts registration stays active so consumer modules remain fully reachable
    expect(mockCatalogProcessing.addProcessor).toHaveBeenCalledTimes(1);
    const processor = mockCatalogProcessing.addProcessor.mock.calls[0][0];

    // Verify it is empty by ensuring it leaves an unrelated entity completely untouched
    const testEntity: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: { name: 'platform', namespace: 'default', annotations: {} },
      spec: { owner: 'guest', type: 'service' },
    };
    const result = await processor.preProcessEntity(testEntity, { type: 'url', target: 'http://localhost' }, vi.fn());
    expect(result.metadata.annotations).toEqual({});
  });
});

describe('FixtureAnnotationProcessor internal mechanics', () => {
  let processorInstance: any;

  beforeEach(async () => {
    const mockCatalogProcessing = {
      addEntityProvider: vi.fn(),
      addProcessor: vi.fn(),
    };

    await startTestBackend({
      features: [catalogDynamicAnnotationsModule],
      extensionPoints: [
        [catalogProcessingExtensionPoint, mockCatalogProcessing],
      ],
    });

    // Capture the instantiated class passed to the extension point
    // @ts-ignore: Accessing private instance for testing purposes
    processorInstance = mockCatalogProcessing.addProcessor.mock.calls[0][0];
  });

  it('should return the correct identifier name', () => {
    expect(processorInstance.getProcessorName()).toBe('FixtureAnnotationProcessor');
  });

  it('should cleanly intercept matching entities and non-destructively merge factory annotations', async () => {
    const mockEntity: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: 'platform',
        namespace: 'default',
        annotations: {
          'existing.io/token': 'keep-me',
        },
      },
      spec: { owner: 'guest', type: 'service' },
    };

    const result = await processorInstance.preProcessEntity(
      mockEntity,
      { type: 'url', target: 'http://localhost' },
      vi.fn()
    );

    // Verify existing data is preserved and new factory tokens are seamlessly merged
    expect(result.metadata.annotations).toEqual({
      'existing.io/token': 'keep-me',
      'mock.io/injected-annotation': 'active-platform',
    });
  });

  it('should return the entity completely untouched if no target reference matches', async () => {
    const unmappedEntity: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: 'unrelated-service',
        annotations: {
          'base.io/tag': 'stable',
        },
      },
      spec: { owner: 'guest', type: 'service' },
    };

    const result = await processorInstance.preProcessEntity(
      unmappedEntity,
      { type: 'url', target: 'http://localhost' },
      vi.fn()
    );

    expect(result.metadata.annotations).toEqual({
      'base.io/tag': 'stable',
    });
  });
});
