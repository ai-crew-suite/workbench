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
import { EntityProvider, EntityProviderConnection } from '@backstage/plugin-catalog-node';
import { getProgrammaticEntities } from '@ai-crew-suite/fixtures-catalog';
import { getProgrammaticTemplates } from '@ai-crew-suite/fixtures-scaffolder';

/**
 * Options controlling which programmatic fixture groups the provider emits.
 */
export interface DynamicFixtureEntityProviderOptions {
  /** Whether to emit the catalog entities from `@ai-crew-suite/fixtures-catalog`. */
  includeCatalogEntities?: boolean;
  /** Whether to emit the scaffolder templates from `@ai-crew-suite/fixtures-scaffolder`. */
  includeScaffolderTemplates?: boolean;
}

export class DynamicFixtureEntityProvider implements EntityProvider {
  private connection?: EntityProviderConnection;
  private readonly includeCatalogEntities: boolean;
  private readonly includeScaffolderTemplates: boolean;

  /**
   * @param options - Toggle fixture groups independently. Both default to
   *   `true`; disabled groups are excluded from the emitted `full` mutation.
   */
  constructor(options: DynamicFixtureEntityProviderOptions = {}) {
    this.includeCatalogEntities = options.includeCatalogEntities ?? true;
    this.includeScaffolderTemplates = options.includeScaffolderTemplates ?? true;
  }

  getProviderName(): string {
    return 'DynamicFixtureEntityProvider';
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;
    await this.refreshEntities();
  }

  async refreshEntities(): Promise<void> {
    if (!this.connection) return;

    const catalogEntities = this.includeCatalogEntities
      ? getProgrammaticEntities()
      : [];
    const scaffolderTemplates = this.includeScaffolderTemplates
      ? getProgrammaticTemplates()
      : [];

    const allProgrammaticEntities = [...catalogEntities, ...scaffolderTemplates];
    const providerName = this.getProviderName();

    const mutations = allProgrammaticEntities.map(entity => {
      const annotations = {
        ...entity.metadata.annotations,
        'backstage.io/managed-by-location': `external:${providerName}`,
        'backstage.io/managed-by-origin-location': `external:${providerName}`,
      };

      return {
        entity: {
          ...entity,
          metadata: {
            ...entity.metadata,
            annotations,
          },
        },
        // Handles namespace collisions across types cleanly using kind/name variations
        locationKey: `dynamic-fixture-provider:${entity.kind.toLowerCase()}:${entity.metadata.name}`,
      };
    });

    await this.connection.applyMutation({
      type: 'full',
      entities: mutations,
    });
  }
}

export const catalogModuleDynamicEntities = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'dynamic-entities',
  register(env) {
    env.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
        config: coreServices.rootConfig,
      },
      async init({ catalog, config }) {
        // Two independent toggles: one for the programmatic catalog entities,
        // one for the programmatic scaffolder templates.
        const catalogEntitiesEnabled =
          config.getOptionalBoolean('aiCrewSuite.modules.dynamicEntities.enabled') ?? true;
        const scaffolderTemplatesEnabled =
          config.getOptionalBoolean('aiCrewSuite.modules.scaffolderTemplates.enabled') ?? true;

        if (!catalogEntitiesEnabled && !scaffolderTemplatesEnabled) {
          console.log(
            '[Catalog-Module] dynamic-entities and scaffolder templates are both explicitly ' +
              'disabled via configuration. Skipping entity seeding.'
          );
          return;
        }

        console.log(
          `[Catalog-Module] dynamic-entities is active ` +
            `(catalogEntities: ${catalogEntitiesEnabled}, ` +
            `scaffolderTemplates: ${scaffolderTemplatesEnabled}). Connecting dynamic fixture provider.`
        );
        catalog.addEntityProvider(
          new DynamicFixtureEntityProvider({
            includeCatalogEntities: catalogEntitiesEnabled,
            includeScaffolderTemplates: scaffolderTemplatesEnabled,
          })
        );
      },
    });
  },
});
