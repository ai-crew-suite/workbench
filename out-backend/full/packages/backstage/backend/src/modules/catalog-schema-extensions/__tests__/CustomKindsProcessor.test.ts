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
import { Entity } from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { CatalogProcessorEmit } from '@backstage/plugin-catalog-node';
import { CustomKindsProcessor } from '../CustomKindsProcessor';

describe('CustomKindsProcessor', () => {
  let processor: CustomKindsProcessor;
  const mockLocation: LocationSpec = { type: 'url', target: 'http://example.com' };
  const mockEmit: CatalogProcessorEmit = vi.fn();

  beforeEach(() => {
    processor = new CustomKindsProcessor();
    vi.clearAllMocks();
  });

  describe('getProcessorName', () => {
    it('returns the correct processor name', () => {
      expect(processor.getProcessorName()).toBe('CustomKindsProcessor');
    });
  });

  describe('validateEntityKind', () => {
    it('returns false for unsupported native kinds', async () => {
      const entity: Entity = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: { name: 'my-component' },
      };
      await expect(processor.validateEntityKind(entity)).resolves.toBe(false);
    });

    it('returns true for supported custom kinds with the correct apiVersion', async () => {
      const entity: Entity = {
        apiVersion: 'ai-crew-suite.dev/v1alpha1',
        kind: 'DataProduct',
        metadata: { name: 'my-data-product' },
      };
      await expect(processor.validateEntityKind(entity)).resolves.toBe(true);
    });

    it('throws an error for supported custom kinds with an invalid apiVersion', async () => {
      const entity: Entity = {
        apiVersion: 'backstage.io/v1alpha1', // Wrong apiVersion
        kind: 'DataProduct',
        metadata: { name: 'my-data-product' },
      };
      await expect(processor.validateEntityKind(entity)).rejects.toThrow(
        "Invalid apiVersion for custom kind DataProduct. Expected 'ai-crew-suite.dev/v1alpha1'"
      );
    });
  });

  describe('postProcessEntity', () => {
    it('passes non-custom kinds through untouched even without spec.owner', async () => {
      // Regression guard: Location entities have no spec.owner, and the
      // pipeline calls postProcessEntity for every kind. Throwing here used
      // to fail processing of the generated catalog locations and blocked
      // all catalog ingestion.
      const entity: Entity = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Location',
        metadata: { name: 'generated-location' },
        spec: { type: 'file', target: '/abs/path/location.yaml' },
      };

      const result = await processor.postProcessEntity(entity, mockLocation, mockEmit);
      expect(result).toEqual(entity);
    });

    it('throws an error if spec is missing or spec.owner is missing', async () => {
      const entity: Entity = {
        apiVersion: 'ai-crew-suite.dev/v1alpha1',
        kind: 'DataProduct',
        metadata: { name: 'invalid-entity' },
      };

      await expect(processor.postProcessEntity(entity, mockLocation, mockEmit)).rejects.toThrow(
        "Entity DataProduct/invalid-entity is missing the mandatory 'spec.owner' property."
      );
    });

    it('passes through custom kinds if they meet all criteria', async () => {
      const entity: Entity = {
        apiVersion: 'ai-crew-suite.dev/v1alpha1',
        kind: 'ArchitectureDecision',
        metadata: { name: 'adr-001' },
        spec: {
          owner: 'team-a',
          status: 'accepted',
        },
      };

      const result = await processor.postProcessEntity(entity, mockLocation, mockEmit);
      expect(result).toEqual(entity);
    });

    describe('Custom Kind Validations', () => {
      it('validates DataProduct specific fields', async () => {
        const invalidEntity: Entity = {
          apiVersion: 'ai-crew-suite.dev/v1alpha1',
          kind: 'DataProduct',
          metadata: { name: 'dp-1' },
          spec: { owner: 'team-a' }, // missing dataGovernancePolicy and slaTarget
        };

        await expect(processor.postProcessEntity(invalidEntity, mockLocation, mockEmit)).rejects.toThrow(
          "DataProduct dp-1 must specify 'dataGovernancePolicy' and 'slaTarget'."
        );
      });

      it('validates Model specific fields', async () => {
        const invalidEntity: Entity = {
          apiVersion: 'ai-crew-suite.dev/v1alpha1',
          kind: 'Model',
          metadata: { name: 'model-1' },
          spec: { owner: 'team-a', trainingDataset: 's3://dataset' }, // missing accuracyThreshold
        };

        await expect(processor.postProcessEntity(invalidEntity, mockLocation, mockEmit)).rejects.toThrow(
          "Model model-1 requires 'trainingDataset' and a numeric 'accuracyThreshold'."
        );
      });

      it('validates Vulnerability specific fields', async () => {
        const invalidEntity: Entity = {
          apiVersion: 'ai-crew-suite.dev/v1alpha1',
          kind: 'Vulnerability',
          metadata: { name: 'vuln-1' },
          spec: { owner: 'security-team' }, // missing targetComponent and severity
        };

        await expect(processor.postProcessEntity(invalidEntity, mockLocation, mockEmit)).rejects.toThrow(
          "Vulnerability vuln-1 requires 'targetComponent' and 'severity' tier links."
        );
      });

      it('validates ArchitectureDecision specific fields', async () => {
        const invalidEntity: Entity = {
          apiVersion: 'ai-crew-suite.dev/v1alpha1',
          kind: 'ArchitectureDecision',
          metadata: { name: 'adr-1' },
          spec: { owner: 'team-b' }, // missing status
        };

        await expect(processor.postProcessEntity(invalidEntity, mockLocation, mockEmit)).rejects.toThrow(
          "ArchitectureDecision adr-1 requires a current design 'status' property."
        );
      });
    });
  });
});
