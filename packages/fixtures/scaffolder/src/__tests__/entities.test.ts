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
import { templateEntityV1beta3Validator } from '@backstage/plugin-scaffolder-common';
import { getProgrammaticTemplates } from '../index';

// Define a strict schema aligning with the Backstage v1beta3 Scaffolder
// Template entity contract enforced by the catalog's ScaffolderEntitiesProcessor.
const backstageTemplateSchema = z.object({
  apiVersion: z.literal('scaffolder.backstage.io/v1beta3'),
  kind: z.literal('Template'),
  metadata: z.object({
    name: z.string()
      .min(1)
      .max(63)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
        message: 'Must be valid DNS subdomain format (lowercase letters, numbers, and hyphens only)',
      }),
    namespace: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    annotations: z.record(z.string(), z.string()).optional(),
    labels: z.record(z.string(), z.string()).optional(),
  }),
  spec: z.object({
    type: z.string().min(1),
    owner: z.string().optional(),
    parameters: z.array(z.record(z.string(), z.unknown())).optional(),
    steps: z.array(z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      action: z.string().min(1),
      input: z.record(z.string(), z.unknown()).optional(),
    })),
    // The runtime v1beta3 JSON Schema requires `output.text` to be an array
    // of Markdown text blob objects (with the blob inside `content`), never
    // a plain string. A string value here causes ScaffolderEntitiesProcessor
    // to reject the template so it never appears in the frontend catalog.
    output: z.object({
      text: z.array(z.object({
        if: z.string().optional(),
        title: z.string().optional(),
        icon: z.string().optional(),
        content: z.string().min(1),
      })).optional(),
    }).optional(),
  }).catchall(z.unknown()),
});

describe('Scaffolder Template Fixtures Structural Integrity Tests', () => {
  it('should validate all programmatic templates against the Backstage v1beta3 specification', () => {
    const templates = getProgrammaticTemplates();

    // Ensure our mock infrastructure generation is populated
    expect(templates.length).toBeGreaterThan(0);

    templates.forEach(entity => {
      // Validate the object structure using our Zod schema
      const parseResult = backstageTemplateSchema.safeParse(entity);

      if (!parseResult.success) {
        // Pretty-print formatting errors to pinpoint exactly which field broke compliance
        console.error(
          `❌ Structural validation failed for template: "${entity.metadata?.name || 'UNKNOWN'}"`,
          JSON.stringify(parseResult.error.format(), null, 2)
        );
      }

      // Assert validation passes
      expect(parseResult.success).toBe(true);
    });
  });

  it('should declare spec.output.text as an array of Markdown text blob objects', () => {
    const templates = getProgrammaticTemplates();

    templates.forEach(entity => {
      const output = (entity.spec as { output?: { text?: unknown } } | undefined)?.output;
      if (output && 'text' in output) {
        expect(Array.isArray(output.text)).toBe(true);
      }
    });
  });

  it('should pass the upstream v1beta3 kind validator used by the catalog ScaffolderEntitiesProcessor', async () => {
    const templates = getProgrammaticTemplates();

    expect(templates.length).toBeGreaterThan(0);

    for (const template of templates) {
      // This is the exact runtime validation path performed by the catalog's
      // ScaffolderEntitiesProcessor; failures here mean the template is
      // rejected and never surfaces in the frontend catalog.
      await expect(templateEntityV1beta3Validator.check(template)).resolves.toBe(true);
    }
  });
});
