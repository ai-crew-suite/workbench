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
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node';
import { CatalogProcessor, CatalogProcessorEmit } from '@backstage/plugin-catalog-node';
import { Entity } from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { catalogAnnotationRegistry } from '@ai-crew-suite/annotations-fixtures';

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

    if (catalogAnnotationRegistry[entityName]) {
      entity.metadata.annotations = entity.metadata.annotations || {};
      const dynamicAnnotations = catalogAnnotationRegistry[entityName](entity);

      entity.metadata.annotations = {
        ...entity.metadata.annotations,
        ...dynamicAnnotations,
      };
    }
    return entity;
  }
}

export const catalogModuleFixtureAnnotations = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'fixture-annotations',
  register(env) {
    env.registerInit({
      deps: { catalog: catalogProcessingExtensionPoint },
      async init({ catalog }) {
        catalog.addProcessor(new FixtureAnnotationProcessor());
      },
    });
  },
});

export default catalogModuleFixtureAnnotations;
