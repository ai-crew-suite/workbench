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
import { testPermissionModule, TestPermissionPolicy } from '../TestPermissionPolicy';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import { PolicyQuery } from '@backstage/plugin-permission-node';

describe('testPermissionModule Stack', () => {
  it('should export a valid backend feature token wrapper', () => {
    expect(testPermissionModule).toBeDefined();
    // Verifies it conforms to the standard Backstage feature structure safely
    expect(typeof testPermissionModule).toBe('object');
  });

  it('should apply a blanket approval ALLOW verdict for incoming requests', async () => {
    // Instantiate the policy directly now that it's exported
    const policy = new TestPermissionPolicy();

    const mockRequest: PolicyQuery = {
      permission: {
        name: 'catalog.entity.read',
        type: 'resource',
        resourceType: 'catalog-entity',
        attributes: { action: 'read' },
      },
    };

    const decision = await policy.handle(mockRequest);
    expect(decision).toEqual({ result: AuthorizeResult.ALLOW });
  });
});
