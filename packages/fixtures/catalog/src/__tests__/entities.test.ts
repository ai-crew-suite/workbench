/*
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
import { getProgrammaticEntities } from '../index';

// Define a strict schema aligning with Backstage Catalog Entity boundaries
const backstageEntitySchema = z.object({
  apiVersion: z.string().startsWith('backstage.io/'),
  kind: z.enum(['Component', 'API', 'Resource', 'System', 'Domain', 'Location']),
  metadata: z.object({
    name: z.string()
      .min(1)
      .max(63)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
        message: 'Must be valid DNS subdomain format (lowercase letters, numbers, and hyphens only)',
      }),
    namespace: z.string().default('default'),
    description: z.string().optional(),
    annotations: z.record(z.string(), z.string()).optional(),
    labels: z.record(z.string(), z.string()).optional(),
  }),
  spec: z.object({
    type: z.string().min(1),
    lifecycle: z.string().min(1),
    owner: z.string().min(1),
  }).catchall(z.unknown()), // Allows extra spec properties per entity kind
});

describe('Catalog Entity Fixtures Structural Integrity Tests', () => {
  it('should validate all programmatic entities against Backstage core specifications', () => {
    const entities = getProgrammaticEntities();

    // Ensure our mock infrastructure generation is populated
    expect(entities.length).toBeGreaterThan(0);

    entities.forEach(entity => {
      // Validate the object structure using our Zod schema
      const parseResult = backstageEntitySchema.safeParse(entity);

      if (!parseResult.success) {
        // Pretty-print formatting errors to pinpoint exactly which field broke compliance
        console.error(
          `❌ Structural validation failed for entity: "${entity.metadata?.name || 'UNKNOWN'}"`,
          JSON.stringify(parseResult.error.format(), null, 2)
        );
      }

      // Assert validation passes
      expect(parseResult.success).toBe(true);
    });
  });
});
