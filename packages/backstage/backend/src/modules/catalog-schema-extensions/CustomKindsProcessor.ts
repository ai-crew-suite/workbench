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
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { Entity } from '@backstage/catalog-model';

/**
 * The custom enterprise kinds governed by this processor's validation contracts.
 */
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
  getProcessorName(): string {
    return 'CustomKindsProcessor';
  }

  async validateEntityKind(entity: Entity): Promise<boolean> {
    if (!CUSTOM_KINDS.includes(entity.kind)) {
      return false;
    }

    if (entity.apiVersion !== 'ai-crew-suite.dev/v1alpha1') {
      throw new Error(`Invalid apiVersion for custom kind ${entity.kind}. Expected 'ai-crew-suite.dev/v1alpha1'`);
    }

    return true;
  }

  /**
   * Enforces the enterprise spec contracts for the custom kinds only.
   *
   * `postProcessEntity` is invoked by the catalog pipeline for every entity
   * kind, not just the kinds this processor claims, so any non-custom kind
   * (e.g. `Location`, which has no `spec.owner`) must pass through untouched.
   * Throwing on foreign kinds fails the whole entity-processing run and
   * blocks all catalog ingestion.
   *
   * @throws when a custom-kind entity violates its required spec contract.
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

// Normalized: Define and export the backend module wrapper token directly from the source code file
export const CustomKindsModule = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'custom-kinds-processor',
  register(reg) {
    reg.registerInit({
      deps: { catalog: catalogProcessingExtensionPoint },
      async init({ catalog }) {
        catalog.addProcessor(new CustomKindsProcessor());
      },
    });
  },
});
