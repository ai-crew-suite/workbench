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
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { Entity, entityKindSchemaValidator } from '@backstage/catalog-model';
import customCatalogSchema from './catalog.schema.json';

const CUSTOM_KINDS = ['DataProduct', 'Model', 'Product', 'Vulnerability', 'ArchitectureDecision'];

interface EnterpriseCustomSpec {
  owner?: string;
  dataGovernancePolicy?: string;
  slaTarget?: string;
  trainingDataset?: string;
  accuracyThreshold?: number;
  targetComponent?: string;
  severity?: string;
  status?: string;
}

export class CustomKindsProcessor implements CatalogProcessor {
  private readonly schemaValidator = entityKindSchemaValidator(customCatalogSchema);

  getProcessorName(): string {
    return 'CustomKindsProcessor';
  }

  /**
   * Overriding validateEntityKind allows us to completely bypass
   * default schema restrictions for these custom Kinds.
   */
  async validateEntityKind(entity: Entity): Promise<boolean> {
    if (!CUSTOM_KINDS.includes(entity.kind)) {
      return false;
    }

    if (entity.apiVersion !== 'ai-crew-suite.dev/v1alpha1') {
      throw new Error(`Invalid apiVersion for custom kind ${entity.kind}. Expected 'ai-crew-suite.dev/v1alpha1'`);
    }

    // Run structural check against catalog.schema.json rules
    const isValid = this.schemaValidator(entity);
    if (!isValid) {
      throw new Error(`Entity structural layout failed catalog.schema.json compliance verification.`);
    }

    return true;
  }

  /**
   * Enforces the enterprise spec contracts for the custom kinds only.
   */
  async postProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    if (!CUSTOM_KINDS.includes(entity.kind)) {
      return entity;
    }

    const spec = entity.spec as EnterpriseCustomSpec | undefined;

    if (!spec || !spec.owner) {
      throw new Error(`Entity ${entity.kind}/${entity.metadata.name} is missing the mandatory 'spec.owner' property.`);
    }

    switch (entity.kind) {
      case 'DataProduct':
        if (!spec.dataGovernancePolicy || !spec.slaTarget) {
          throw new Error(`DataProduct ${entity.metadata.name} must specify 'dataGovernancePolicy' and 'slaTarget'.`);
        }
        break;
      case 'Model':
        if (!spec.trainingDataset || spec.accuracyThreshold === undefined) {
          throw new Error(`Model ${entity.metadata.name} requires 'trainingDataset' and a numeric 'accuracyThreshold'.`);
        }
        break;
      case 'Vulnerability':
        if (!spec.targetComponent || !spec.severity) {
          throw new Error(`Vulnerability ${entity.metadata.name} requires 'targetComponent' and 'severity' tier links.`);
        }
        break;
      case 'ArchitectureDecision':
        if (!spec.status) {
          throw new Error(`ArchitectureDecision ${entity.metadata.name} requires a current design 'status' property.`);
        }
        break;
    }

    return entity;
  }
}

export const CustomKindsModule = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'custom-kinds-processor',
  register(reg) {
    reg.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
        config: coreServices.rootConfig,
      },
      async init({ catalog, config }) {
        const isEnabled = config.getOptionalBoolean('aiCrewSuite.modules.customKinds.enabled') ?? true;

        if (!isEnabled) {
          console.log('[Catalog-Module] custom-kinds-processor is explicitly disabled via configuration. Skipping structural validation rules.');
          return;
        }

        console.log('[Catalog-Module] custom-kinds-processor is active. Registering enterprise data contracts.');
        catalog.addProcessor(new CustomKindsProcessor());
      },
    });
  },
});
