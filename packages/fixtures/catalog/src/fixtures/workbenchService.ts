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
import {
  Entity,
  ComponentEntity,
  LocationEntity
} from '@backstage/catalog-model';

// Helper interface to construct standard Backstage Core Domain/System structures
interface GenericEntity extends Entity {
  spec: Record<string, unknown>;
}

/**
 * Generates the central runtime topology fixtures for the dev workspace environment.
 */
export function getWorkbenchTopologyEntities(): Entity[] {
  // 1. DOMAIN: Agentic Capabilities
  const domainEntity: GenericEntity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Domain',
    metadata: {
      name: 'agentic-capabilities',
      description: 'Core autonomous operational and cognitive reasoning capabilities for the enterprise.',
    },
    spec: {
      owner: 'platform-team',
    },
  };

  // 2. SYSTEM: Crew Suite
  const systemEntity: GenericEntity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'System',
    metadata: {
      name: 'crew-suite',
      description: 'The integrated AI Crew Suite engine comprising orchestration runtimes, interfaces, and tools.',
    },
    spec: {
      owner: 'platform-team',
      domain: 'agentic-capabilities',
    },
  };

  // 3. COMPONENT: Platform Core Engine
  const platformComponent: ComponentEntity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'platform',
      description: 'Core workflow execution service managing Temporal pipelines and Mem0 long-term memory tracks.',
      annotations: {
        'backstage.io/techdocs-ref': 'dir:.',
        'temporal.io/namespace': 'ai-crew-suite-prod',
        'pagerduty.com/service-id': 'SRV-PLATFORM',
        'datadoghq.com/dashboard-url': 'https://datadoghq.com',
      },
    },
    spec: {
      type: 'service',
      lifecycle: 'production',
      owner: 'platform-team',
      system: 'crew-suite',
      providesApis: ['platform-workflow-api'],
    },
  };

  // 4. COMPONENT: Integration Drivers
  const driversComponent: ComponentEntity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'drivers',
      description: 'Third-party integration tools exposing platforms like PagerDuty and Datadog as functional agents.',
      annotations: {
        'backstage.io/techdocs-ref': 'dir:.',
      },
    },
    spec: {
      type: 'library',
      lifecycle: 'production',
      owner: 'tools-crew-team',
      system: 'crew-suite',
      dependsOn: ['component:platform'],
    },
  };

  // 5. COMPONENT: Frontend Portal Application
  const agentsComponent: ComponentEntity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'agents',
      description: 'User-facing dashboard portal and orchestration gateway assembling core workflows and telemetry plugins.',
      annotations: {
        'backstage.io/techdocs-ref': 'dir:.',
      },
    },
    spec: {
      type: 'website',
      lifecycle: 'production',
      owner: 'product-ux-team',
      system: 'crew-suite',
      dependsOn: ['component:platform', 'component:drivers'],
    },
  };

  // 6. LOCATION: Automated Ingestion Discovery Reference
  const discoveryLocation: LocationEntity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Location',
    metadata: {
      name: 'local-workspace-discovery',
      description: 'Automated local path index scanning for sandbox testing routines.',
    },
    spec: {
      type: 'file',
      targets: ['./catalog-fixtures.yaml'],
    },
  };

  return [
    domainEntity,
    systemEntity,
    platformComponent,
    driversComponent,
    agentsComponent,
    discoveryLocation,
  ];
}
