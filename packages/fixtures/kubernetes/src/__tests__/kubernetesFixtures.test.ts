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
import { getAllKubernetesMappings, getAllKubernetesResourcePayloads } from '../index';

describe('Kubernetes Fixtures Datastore', () => {
  it('should compile and return valid Wiremock stubs', () => {
    const mappings = getAllKubernetesMappings();
    expect(Array.isArray(mappings)).toBe(true);
    expect(mappings.length).toBeGreaterThan(0);

    // FIXED: Safely extract the first element and check definition before accessing sub-properties
    const firstMapping = mappings[0];
    expect(firstMapping).toBeDefined();

    if (firstMapping) {
      expect(firstMapping.request.method).toBe('GET');
      expect(typeof firstMapping.response.status).toBe('number');
    }
  });

  it('should load correct resource payloads matching cluster names', () => {
    const payloads = getAllKubernetesResourcePayloads();
    expect(payloads).toHaveProperty('cluster-deployments.json');
    expect(payloads).toHaveProperty('payment-pods.json');

    const deploymentsPayload = payloads['cluster-deployments.json'];
    expect(deploymentsPayload).toBeDefined();

    // Confirm that our components are inside the deployment collection list
    const deploymentItems = deploymentsPayload.items;
    expect(Array.isArray(deploymentItems)).toBe(true);

    const names = deploymentItems.map((item: any) => item.metadata.name);

    expect(names).toContain('payment-service');
    expect(names).toContain('auth-service');
    expect(names).toContain('notification-service');
  });
});
