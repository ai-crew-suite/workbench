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
import { Entity } from '@backstage/catalog-model';
import { TemplateEntityV1beta3 as TemplateEntity } from '@backstage/plugin-scaffolder-common';

/**
 * Generates the central programmatic Scaffolder Template fixtures for the dev workspace sandbox.
 */
export function getWorkbenchScaffolderTemplates(): Entity[] {

  // 1. Baseline Hermetic Offline Test Template
  const offlineHelloWorldTemplate: TemplateEntity = {
    apiVersion: 'scaffolder.backstage.io/v1beta3',
    kind: 'Template',
    metadata: {
      name: 'offline-hello-world',
      title: 'Offline Hello World Scaffold',
      description:
        'A hermetic test scaffold that exercises the scaffolder task engine using only ' +
        'offline-safe actions (debug:log). Requires no external network, cloud credentials, ' +
        'or git remotes, making it the baseline fixture for validating /api/scaffolder endpoints.',
      tags: ['testpad', 'offline', 'scaffolder'],
    },
    spec: {
      type: 'service',
      owner: 'platform-team',
      parameters: [
        {
          title: 'Provide a few simple values',
          required: ['name'],
          properties: {
            name: {
              title: 'Name',
              type: 'string',
              description: 'The name to greet in the scaffolded output.',
            },
            message: {
              title: 'Message',
              type: 'string',
              default: 'Hello from the offline testpad scaffolder!',
              description: 'Free-form text echoed by the debug log step.',
            },
          },
        },
      ],
      steps: [
        {
          id: 'log',
          name: 'Log the resolved parameters',
          action: 'debug:log',
          input: {
            message: '${{ parameters.name }} :: ${{ parameters.message }}',
          },
        },
      ],
      output: {
        // FIXED: Converted from an object array to a type-safe string property string property
        text: 'Offline scaffold finished successfully for parameter name: ${{ parameters.name }}',
      },
    },
  };

  // 2. Secondary AI-Crew-Suite Demo Template
  const aiAgentProvisionerTemplate: TemplateEntity = {
    apiVersion: 'scaffolder.backstage.io/v1beta3',
    kind: 'Template',
    metadata: {
      name: 'ai-agent-provisioner',
      title: 'AI Agent Runtime Provisioner',
      description:
        'Simulates bootstrapping a containerized autonomous agent runtime container and ' +
        'registering programmatic execution tokens within the AI Crew Suite workspace routing engine.',
      tags: ['ai-crew', 'agents', 'automation', 'demo'],
    },
    spec: {
      type: 'agent',
      owner: 'tools-crew-team',
      parameters: [
        {
          title: 'Agent Identity Specs',
          required: ['agentName', 'modelBacking'],
          properties: {
            agentName: {
              title: 'Agent Name',
              type: 'string',
              description: 'Alphanumeric structural handle for the autonomous worker entity.',
            },
            modelBacking: {
              title: 'Model Engine Backing',
              type: 'string',
              description: 'The LLM orchestration core providing reasoning weights to this agent.',
              default: 'gpt-4o',
              enum: ['gpt-4o', 'claude-3-5-sonnet', 'llama-3-70b-instruct'],
            },
          },
        },
        {
          title: 'Capabilities & Scopes',
          properties: {
            maxIterations: {
              title: 'Max Execution Loops',
              type: 'number',
              default: 15,
              description: 'Safety ceiling to avoid runaway reasoning cycles.',
            },
            enableMemory: {
              title: 'Vector Store Ephemeral Memory',
              type: 'boolean',
              default: true,
              description: 'Allows the agent to retain task state patterns over long-context tasks.',
            },
          },
        },
      ],
      steps: [
        {
          id: 'validate-input',
          name: 'Verify parameters against AI engine capabilities',
          action: 'debug:log',
          input: {
            message: 'Validating configuration matrix for Agent: ${{ parameters.agentName }} backed by ${{ parameters.modelBacking }}.',
          },
        },
        {
          id: 'mock-token-generation',
          name: 'Simulate runtime credentials allocation',
          action: 'debug:log',
          input: {
            message: 'Successfully allocated virtual context stream memory space. Persistent limits set to maximum iterations: ${{ parameters.maxIterations }}. Memory array enabled: ${{ parameters.enableMemory }}.',
          },
        },
      ],
      output: {
        // FIXED: Converted from an object array to a type-safe string property
        text: 'Your synthetic workspace agent **${{ parameters.agentName }}** is fully seeded and available under topology rules via routing cluster endpoint defaults.',
      },
    },
  };

  return [
    offlineHelloWorldTemplate,
    aiAgentProvisionerTemplate,
  ];
}
