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
import { createBackendModule, coreServices } from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node';
import { CatalogProcessor, CatalogProcessorEmit } from '@backstage/plugin-catalog-node';
import { Entity, stringifyEntityRef, parseEntityRef } from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { catalogAnnotationFixtures, EntityAnnotationFixture } from '@ai-crew-suite/fixtures-annotations';

export class FixtureAnnotationProcessor implements CatalogProcessor {
  // Use a compiled Map for fast, O(1) compound key lookups
  private fixturesMap = new Map<string, EntityAnnotationFixture['factory']>();

  constructor(fixtures: EntityAnnotationFixture[]) {
    for (const fixture of fixtures) {
      try {
        // Normalize the entity ref format (e.g. 'Component:default/platform')
        const normalizedRef = stringifyEntityRef(parseEntityRef(fixture.targetEntityRef));
        this.fixturesMap.set(normalizedRef, fixture.factory);
      } catch (err) {
        console.error(`[FixtureAnnotationProcessor] Invalid target reference: ${fixture.targetEntityRef}`, err);
      }
    }
  }

  getProcessorName(): string {
    return 'FixtureAnnotationProcessor';
  }

  async preProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    // Generate the standard reference string for the active entity in flight
    const currentEntityRef = stringifyEntityRef(entity);

    // If a fixture matches this entity, execute the factory string builder
    const factory = this.fixturesMap.get(currentEntityRef);
    if (factory) {
      entity.metadata.annotations = {
        ...entity.metadata.annotations,
        ...factory(entity),
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
      deps: {
        catalog: catalogProcessingExtensionPoint,
        config: coreServices.rootConfig,
      },
      async init({ catalog, config }) {
        const isEnabled = config.getOptionalBoolean('aiCrewSuite.modules.fixtureAnnotations.enabled') ?? true;

        if (!isEnabled) {
          console.log('[Catalog-Module] fixture-annotations is explicitly disabled via configuration. Skipping registration.');
          return;
        }

        console.log('[Catalog-Module] fixture-annotations is active. Initializing annotation hooks.');
        catalog.addProcessor(new FixtureAnnotationProcessor(catalogAnnotationFixtures));
      },
    });
  },
});
