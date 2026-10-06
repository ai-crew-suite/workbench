import { CatalogProcessor, CatalogProcessorEmit } from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { Entity } from '@backstage/catalog-model';

export class EnterpriseCustomKindsProcessor implements CatalogProcessor {
  // 1. Tell the catalog loader engine the name of this compliance processor
  getProcessorName(): string {
    return 'EnterpriseCustomKindsProcessor';
  }

  // 2. Intercept entity validation loops on boot/sync ticks
  async validateEntityKind(entity: Entity): Promise<boolean> {
    const validCustomKinds = ['DataProduct', 'Model', 'Product', 'Vulnerability', 'ArchitectureDecision'];

    // If the entity matches our custom domains, intercept it to validate its custom specs
    if (validCustomKinds.includes(entity.kind)) {
      if (entity.apiVersion !== 'ai-crew-suite.dev/v1alpha1') {
        throw new Error(`Invalid apiVersion for custom kind ${entity.kind}. Expected 'ai-crew-suite.dev/v1alpha1'`);
      }
      return true; // Validates kind identity signature matching
    }

    return false; // Pass through to standard native Backstage validators
  }

  // 3. Deep compliance data structure checking
  async postProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    const spec = entity.spec as Record<string, any>;

    if (!spec || !spec.owner) {
      throw new Error(`Entity ${entity.kind}/${entity.metadata.name} is missing the mandatory 'spec.owner' property.`);
    }

    // Custom deep field assertions matching your specification rules
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
