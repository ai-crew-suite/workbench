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
import { getKubernetesClusterFixtures } from './fixtures/clusterData';
import { WiremockMapping } from './types';

export type { WiremockMapping, KubernetesFixtureContainer } from './types';

/**
 * Aggregates all Kubernetes specific Wiremock API routing mappings.
 */
export const getAllKubernetesMappings = (): WiremockMapping[] => {
  return getKubernetesClusterFixtures().wiremockMappings;
};

/**
 * Aggregates all mock JSON resource structures (Pods, Deployments) for cluster queries.
 */
export const getAllKubernetesResourcePayloads = (): Record<string, any> => {
  return getKubernetesClusterFixtures().resourcePayloads;
};
