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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OptionalLocalFixturesProcessor } from '../OptionalLocalFixturesProcessor';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { CatalogProcessorEmit } from '@backstage/plugin-catalog-node';
import * as fs from 'fs';

// Mock the native filesystem modules
vi.mock('fs');

describe('OptionalLocalFixturesProcessor', () => {
  let processor: OptionalLocalFixturesProcessor;
  let mockEmit: CatalogProcessorEmit;

  const validLocation: LocationSpec = {
    type: 'crew-suite-optional-fixtures',
    target: './catalog-fixtures.yaml',
  };

  beforeEach(() => {
    processor = new OptionalLocalFixturesProcessor();
    mockEmit = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should ignore unsupported location types cleanly', async () => {
    const invalidLocation: LocationSpec = {
      type: 'file',
      target: './catalog-info.yaml',
    };

    const handled = await processor.readLocation(invalidLocation, false, mockEmit);

    // Returning false tells Backstage: "I didn't handle this type, pass it on."
    expect(handled).toBe(false);
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('should pass silently and return true if target file does not exist', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const handled = await processor.readLocation(validLocation, false, mockEmit);

    // Returning true tells Backstage: "I handled this type successfully (by skipping it safely)."
    expect(handled).toBe(true);
    expect(fs.readFileSync).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('should read, parse, and emit valid entities from multi-document YAML targets', async () => {
    const mockYamlContent = `
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: dynamic-test-service
spec:
  type: service
  owner: test-team
---
apiVersion: backstage.io/v1alpha1
kind: System
metadata:
  name: test-system
spec:
  owner: test-team
    `;

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(mockYamlContent);

    const handled = await processor.readLocation(validLocation, false, mockEmit);

    expect(handled).toBe(true);
    // Verifies that both documents were parsed and pushed to the pipeline independently
    expect(mockEmit).toHaveBeenCalledTimes(2);
    expect(mockEmit).toHaveBeenNthCalledWith(1, {
      type: 'entity',
      location: validLocation,
      entity: expect.objectContaining({
        kind: 'Component',
        metadata: expect.objectContaining({ name: 'dynamic-test-service' }),
      }),
    });
  });
});
