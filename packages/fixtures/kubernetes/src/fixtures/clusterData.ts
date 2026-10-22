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
import { KubernetesFixtureContainer } from '../types';

export const getKubernetesClusterFixtures = (): KubernetesFixtureContainer => {
  const namespace = 'ai-crew-suite-dev';

  const paymentPodList = {
    apiVersion: 'v1',
    kind: 'PodList',
    metadata: { selfLink: `/api/v1/namespaces/${namespace}/pods`, resourceVersion: '20261021' },
    items: [
      {
        metadata: {
          name: 'payment-service-7f5d9bc4-abc12',
          namespace,
          labels: { app: 'payment-service', tier: 'backend' },
          creationTimestamp: '2026-10-21T00:00:00Z',
        },
        status: {
          phase: 'Running',
          conditions: [{ type: 'Ready', status: 'True' }],
          containerStatuses: [{ name: 'payment-service-container', ready: true, restartCount: 0 }],
          podIP: '10.244.1.42',
        },
      },
    ],
  };

  const deploymentList = {
    apiVersion: 'apps/v1',
    kind: 'DeploymentList',
    metadata: { resourceVersion: '20261021' },
    items: [
      {
        metadata: { name: 'payment-service', namespace, labels: { app: 'payment-service' } },
        spec: { replicas: 1, selector: { matchLabels: { app: 'payment-service' } } },
        status: { replicas: 1, updatedReplicas: 1, readyReplicas: 1, availableReplicas: 1 },
      },
      {
        metadata: { name: 'auth-service', namespace, labels: { app: 'auth-service' } },
        spec: { replicas: 2, selector: { matchLabels: { app: 'auth-service' } } },
        status: { replicas: 2, updatedReplicas: 2, readyReplicas: 2, availableReplicas: 2 },
      },
      {
        metadata: { name: 'notification-service', namespace, labels: { app: 'notification-service' } },
        spec: { replicas: 1, selector: { matchLabels: { app: 'notification-service' } } },
        status: { replicas: 1, updatedReplicas: 1, readyReplicas: 1, availableReplicas: 1 },
      },
    ],
  };

  return {
    resourcePayloads: {
      'payment-pods.json': paymentPodList,
      'cluster-deployments.json': deploymentList,
    },
    wiremockMappings: [
      {
        id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        name: 'k8s_get_namespaces',
        request: {
          method: 'GET',
          url: '/api/v1/namespaces',
        },
        response: {
          status: 200,
          body: JSON.stringify({
            apiVersion: 'v1',
            kind: 'NamespaceList',
            items: [{ metadata: { name: 'default' } }, { metadata: { name: namespace } }],
          }),
          headers: { 'Content-Type': 'application/json' },
        },
      },
      {
        id: 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
        name: 'k8s_get_deployments',
        request: {
          method: 'GET',
          urlPath: `/apis/apps/v1/namespaces/${namespace}/deployments`,
        },
        response: {
          status: 200,
          bodyFileName: 'cluster-deployments.json',
          headers: { 'Content-Type': 'application/json' },
        },
      },
      {
        id: 'c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f',
        name: 'k8s_get_payment_pods',
        request: {
          method: 'GET',
          urlPath: `/api/v1/namespaces/${namespace}/pods`,
          queryParameters: {
            labelSelector: { equalTo: 'app=payment-service' },
          },
        },
        response: {
          status: 200,
          bodyFileName: 'payment-pods.json',
          headers: { 'Content-Type': 'application/json' },
        },
      },
    ],
  };
};
