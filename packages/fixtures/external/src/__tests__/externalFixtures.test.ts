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
import { getAllProgrammaticMappings, getAllProgrammaticVendorPayloads } from '../index';

describe('External Fixtures Datastore', () => {
  describe('Wiremock Mappings Validation', () => {
    it('should aggregate and return all programmatic stub configurations', () => {
      const mappings = getAllProgrammaticMappings();

      expect(Array.isArray(mappings)).toBe(true);
      expect(mappings.length).toBeGreaterThan(0);
    });

    it('should conform to strict Wiremock structural validation constraints', () => {
      const mappings = getAllProgrammaticMappings();

      for (const mapping of mappings) {
        // All stubs must declare a valid HTTP execution method
        expect(mapping.request).toBeDefined();
        expect(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).toContain(mapping.request.method);

        // Ensure response block is fully formed with a numeric status code
        expect(mapping.response).toBeDefined();
        expect(typeof mapping.response.status).toBe('number');

        // Assert it serves either an inline string body OR binds an external file reference
        const hasBody = mapping.response.body !== undefined;
        const hasBodyFile = mapping.response.bodyFileName !== undefined;
        expect(hasBody || hasBodyFile).toBe(true);
      }
    });

    it('should properly contain critical vendor endpoints', () => {
      const mappings = getAllProgrammaticMappings();
      const urls = mappings.map(m => m.request.url || m.request.urlPath);

      expect(urls).toContain('/api/v1/validate');
      expect(urls).toContain('/api/v1/monitor');
      expect(urls).toContain('/incidents');
    });
  });

  describe('Vendor JSON Payloads Verification', () => {
    it('should load pre-compiled data assets into the key-value dictionary map', () => {
      const payloads = getAllProgrammaticVendorPayloads();

      expect(payloads).toHaveProperty('datadog-metrics.json');
      expect(payloads).toHaveProperty('datadog-monitors.json');
      expect(payloads).toHaveProperty('pagerduty-incidents.json');
    });

    it('should maintain structured arrays for multi-entity telemetry responses', () => {
      const payloads = getAllProgrammaticVendorPayloads();

      // Validate the structure matches your legacy __files structures
      expect(Array.isArray(payloads['datadog-monitors.json'])).toBe(true);
      expect(payloads['datadog-monitors.json'].length).toBe(3);
      expect(payloads['datadog-monitors.json'][0].name).toContain('Core Workflow Task Processing Latency Spike');

      expect(Array.isArray(payloads['pagerduty-incidents.json'].incidents)).toBe(true);
      expect(payloads['pagerduty-incidents.json'].incidents[0].id).toBe('INC-0042-LEAK');
    });
  });
});
