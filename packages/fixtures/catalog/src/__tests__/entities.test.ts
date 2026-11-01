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
import { describe, it, expect } from 'vitest';
import {
  apiEntityV1alpha1Validator,
  componentEntityV1alpha1Validator,
  domainEntityV1alpha1Validator,
  entitySchemaValidator,
  groupEntityV1alpha1Validator,
  locationEntityV1alpha1Validator,
  resourceEntityV1alpha1Validator,
  systemEntityV1alpha1Validator,
  userEntityV1alpha1Validator,
  type KindValidator,
} from '@backstage/catalog-model';
import { getProgrammaticEntities } from '../index';

const kindValidators: Record<string, KindValidator> = {
  API: apiEntityV1alpha1Validator,
  Component: componentEntityV1alpha1Validator,
  Domain: domainEntityV1alpha1Validator,
  Group: groupEntityV1alpha1Validator,
  Location: locationEntityV1alpha1Validator,
  Resource: resourceEntityV1alpha1Validator,
  System: systemEntityV1alpha1Validator,
  User: userEntityV1alpha1Validator,
};

describe('Catalog Entity Fixtures Structural Integrity Tests', () => {
  it('should validate all programmatic entities against Backstage core specifications', async () => {
    const entities = getProgrammaticEntities();

    // Ensure our mock infrastructure generation is populated
    expect(entities.length).toBeGreaterThan(0);

    const validateEntity = entitySchemaValidator();
    for (const entity of entities) {
      const entityRef = `${entity.kind}:${entity.metadata.name}`;
      expect(() => validateEntity(entity), `Invalid entity envelope: ${entityRef}`).not.toThrow();

      const validator = kindValidators[entity.kind];
      if (!validator) throw new Error(`No Backstage kind validator is configured for ${entityRef}.`);
      await expect(validator.check(entity), `Invalid entity specification: ${entityRef}`).resolves.toBe(true);
    }
  });
});
