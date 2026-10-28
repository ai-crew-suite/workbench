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
import { normalizeTargetName, resolveTargetTags } from '../registry-utils.js';

describe('Registry Utilities Unit Suite', () => {
  describe('normalizeTargetName', () => {
    it('should strip scoped namespaces and container suffixes cleanly', () => {
      expect(normalizeTargetName('@ai-crew-suite/grafana-container')).toBe('grafana');
      expect(normalizeTargetName('workbench-temporal-container')).toBe('temporal');
      expect(normalizeTargetName('backend')).toBe('backend');
    });

    it('should handle un-scoped container names gracefully', () => {
      expect(normalizeTargetName('frontend-container')).toBe('frontend');
    });
  });

  describe('resolveTargetTags', () => {
    it('should format clean local loopback paths when using Zot endpoints', () => {
      const registry = 'localhost:32443/ai-crew-suite';
      const result = resolveTargetTags('@ai-crew-suite/temporal-container', registry, 'v1.0.0');

      expect(result.localSourceTag).toBe('local/temporal:v1.0.0');
      // Zot uses un-prefixed namespaces natively
      expect(result.remoteTargetTag).toBe('localhost:32443/ai-crew-suite/temporal:v1.0.0');
    });

    it('should append the workbench prefix for remote distribution clouds like GHCR', () => {
      const registry = 'ghcr.io/ai-crew-suite';
      const result = resolveTargetTags('mem0-container', registry, 'latest');

      expect(result.localSourceTag).toBe('local/mem0:latest');
      // Non-Zot registries require standard repository structural naming prefixes
      expect(result.remoteTargetTag).toBe('ghcr.io/ai-crew-suite/workbench-mem0:latest');
    });
  });
});
