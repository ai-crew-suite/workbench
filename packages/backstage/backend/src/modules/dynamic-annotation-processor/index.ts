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
import { createBackendModule } from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node/alpha';
import { CatalogProcessor, CatalogProcessorEmit } from '@backstage/plugin-catalog-node';
import { Entity } from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';

// Import your custom fixtures package
import { catalogFixtureRegistry } from '@ai-crew-suite/catalog-fixtures';

class FixtureAnnotationProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'FixtureAnnotationProcessor';
  }

  async preProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    const entityName = entity.metadata.name;

    // Check if we have a registered TypeScript factory for this specific entity name
    if (catalogFixtureRegistry[entityName]) {
      entity.metadata.annotations = entity.metadata.annotations || {};

      // Execute the factory function to get the dynamic annotations
      const dynamicAnnotations = catalogFixtureRegistry[entityName](entity);

      // Merge them into the existing entity annotations
      entity.metadata.annotations = {
        ...entity.metadata.annotations,
        ...dynamicAnnotations,
      };
    }

    return entity;
  }
}

export const dynamicAnnotationProcessor = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'fixture-annotations',
  register(env) {
    env.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
      },
      async init({ catalog }) {
        catalog.addProcessor(new FixtureAnnotationProcessor());
      },
    });
  },
});

export default dynamicAnnotationProcessor;
