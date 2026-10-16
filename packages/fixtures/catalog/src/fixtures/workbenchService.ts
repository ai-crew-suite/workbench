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
import {
  Entity,
  ComponentEntity,
  GroupEntity,
  UserEntity,
} from '@backstage/catalog-model';
import { GenericEntity } from '../types';

/**
 * Generates the central runtime topology fixtures for the dev workspace environment.
 */
export function getWorkbenchTopologyEntities(): Entity[] {
  // Root Parent Group
  const engineeringGroup: GroupEntity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Group',
    metadata: {
      name: 'engineering',
      description: 'The global engineering division at AI Crew Suite.',
    },
    spec: {
      type: 'division',
      children: ['platform-team', 'tools-crew-team', 'product-ux-team'],
    },
  };

  // Sub-Group 1: Platform Team
  const platformTeam: GroupEntity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Group',
    metadata: {
      name: 'platform-team',
      description: 'Core runtime framework infra and pipe engineering squad.',
    },
    spec: {
      type: 'team',
      parent: 'engineering',
      members: ['kevin', 'alex'],
      children: [],
    },
  };

  // Sub-Group 2: Tools Crew Team
  const toolsCrewTeam: GroupEntity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Group',
    metadata: {
      name: 'tools-crew-team',
      description: 'Integrations and agentic action utility developers.',
    },
    spec: {
      type: 'team',
      parent: 'engineering',
      members: ['sarah'],
      children: [],
    },
  };

  // Sub-Group 3: Product UX Team
  const productUxTeam: GroupEntity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Group',
    metadata: {
      name: 'product-ux-team',
      description: 'Frontend interfaces, orchestration portals, and user journey designers.',
    },
    spec: {
      type: 'team',
      parent: 'engineering',
      members: ['alex'],
      children: [],
    },
  };

  // User 1: Kevin (Platform Engineer)
  const userKevin: UserEntity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'User',
    metadata: {
      name: 'kevin',
      description: 'Principal Sandbox Architect',
    },
    spec: {
      profile: {
        displayName: 'Kevin Workbench',
        email: 'kevin@ai-crew-suite.io',
      },
      memberOf: ['platform-team'],
    },
  };

  // User 2: Alex (Cross-functional Engineer)
  const userAlex: UserEntity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'User',
    metadata: {
      name: 'alex',
      description: 'Full Stack Orchestration Engineer',
    },
    spec: {
      profile: {
        displayName: 'Alex Matrix',
        email: 'alex@ai-crew-suite.io',
      },
      memberOf: ['platform-team', 'product-ux-team'],
    },
  };

  // User 3: Sarah (Integration Engineer)
  const userSarah: UserEntity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'User',
    metadata: {
      name: 'sarah',
      description: 'Agent Integration Specialist',
    },
    spec: {
      profile: {
        displayName: 'Sarah Driver',
        email: 'sarah@ai-crew-suite.io',
      },
      memberOf: ['tools-crew-team'],
    },
  };

  // =========================================================================
  // 🧭 ARCHITECTURAL TOPOLOGY SEEDS
  // =========================================================================

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

  return [
    engineeringGroup,
    platformTeam,
    toolsCrewTeam,
    productUxTeam,
    userKevin,
    userAlex,
    userSarah,
    domainEntity,
    systemEntity,
    platformComponent,
    driversComponent,
    agentsComponent,
  ];
}
