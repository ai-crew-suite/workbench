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
import { z } from 'zod';
import { Entity } from '@backstage/catalog-model';
import { annotationsFixtureRegistry } from '../index';

// 1. Define the validation schema for your stringified JSON payload
const fixturePayloadSchema = z.object({
  generatedAt: z.string().datetime(), // Validates ISO 8601 string format
  fixtureStatus: z.enum(['active', 'inactive', 'deprecated']),
  notes: z.string().min(1),
});

describe('Catalog Fixture Registry Integration Tests', () => {
  // Mock a baseline Backstage entity to pass into the factory functions
  const mockEntity: Entity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'payment-service',
      namespace: 'default',
    },
    spec: {
      type: 'service',
      owner: 'finance-team',
    },
  };

  it('should verify all registered factories produce valid structures', () => {
    const registryKeys = Object.keys(annotationsFixtureRegistry);

    // Ensure the registry isn't accidentally empty
    expect(registryKeys.length).toBeGreaterThan(0);

    registryKeys.forEach(entityName => {
      const factoryFn = annotationsFixtureRegistry[entityName];

      // Execute the factory function using our mock context
      const result = factoryFn(mockEntity);

      // Verify the expected annotation wrapper key exists
      expect(result).toHaveProperty('://ai-crew.com');

      const rawPayload = result['://ai-crew.com'];
      expect(typeof rawPayload).toBe('string');

      // Attempt to parse the stringified JSON payload
      let parsedPayload: unknown;
      expect(() => {
        parsedPayload = JSON.parse(rawPayload);
      }).not.toThrow();

      // Validate the parsed payload structure against our Zod schema
      const validationResult = fixturePayloadSchema.safeParse(parsedPayload);

      // If validation fails, output a helpful error message indicating which entity failed
      if (!validationResult.success) {
        console.error(`Validation failed for entity fixture: "${entityName}"`, validationResult.error.format());
      }

      expect(validationResult.success).toBe(true);
    });
  });
});
