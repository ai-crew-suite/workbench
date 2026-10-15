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
import { EntityProvider, EntityProviderConnection } from '@backstage/plugin-catalog-node';
import { getProgrammaticEntities } from '@ai-crew-suite/catalog-entities-fixtures';

export class DynamicFixtureEntityProvider implements EntityProvider {
  private connection?: EntityProviderConnection;

  getProviderName(): string {
    return 'DynamicFixtureEntityProvider';
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;
    await this.refreshEntities();
  }

  async refreshEntities(): Promise<void> {
    if (!this.connection) return;

    const programmaticEntities = getProgrammaticEntities();
    const providerName = this.getProviderName(); // 'DynamicFixtureEntityProvider'

    const mutations = programmaticEntities.map(entity => {
      // Dynamically inject the correct structural location tracking annotations required by Backstage
      const annotations = {
        ...entity.metadata.annotations,
        'backstage.io/managed-by-location': `external:${providerName}`,
        'backstage.io/managed-by-origin-location': `external:${providerName}`, // <-- FIXED KEY NAME HERE
      };

      return {
        entity: {
          ...entity,
          metadata: {
            ...entity.metadata,
            annotations,
          },
        },
        locationKey: `dynamic-fixture-provider:${entity.metadata.name}`,
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
      deps: { catalog: catalogProcessingExtensionPoint },
      async init({ catalog }) {
        catalog.addEntityProvider(new DynamicFixtureEntityProvider());
      },
    });
  },
});

export default catalogModuleDynamicEntities;
