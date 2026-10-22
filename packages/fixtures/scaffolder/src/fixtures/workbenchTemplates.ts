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
import { TemplateEntityV1beta3 } from '@backstage/plugin-scaffolder-common';

/**
 * A single Markdown text blob in a Template `spec.output.text` list.
 *
 * The v1beta3 runtime JSON Schema requires `output.text` to be an array of
 * these objects rather than a plain string, so the blob itself lives in
 * `content`.
 */
type TemplateOutputText = {
  /** Templated condition that excludes this blob when it evaluates to false. */
  if?: string;
  /** User friendly display name for the text blob. */
  title?: string;
  /** Key representing a visual icon displayed alongside the text blob. */
  icon?: string;
  /** Markdown text blob rendered in the scaffolder task completion UI. */
  content: string;
};

/**
 * Runtime-valid shape of a Template `spec.output` section.
 *
 * @see The upstream `TemplateEntityV1beta3` TypeScript type declares output
 *      values as plain strings, but the authoritative `Template.v1beta3` JSON
 *      Schema enforced by the catalog's `ScaffolderEntitiesProcessor` requires
 *      `output.text` to be an array of Markdown text blob objects (and
 *      `output.links` an array of link objects). This type mirrors the JSON
 *      Schema so fixtures pass runtime entity validation.
 */
type TemplateOutput = {
  /** Markdown text blobs surfaced on the scaffolder task completion screen. */
  text?: TemplateOutputText[];
};

/**
 * A `TemplateEntityV1beta3` whose `spec.output` matches the runtime JSON
 * Schema rather than the looser upstream TypeScript declaration.
 */
type WorkbenchTemplateEntity = Omit<TemplateEntityV1beta3, 'spec'> & {
  spec: Omit<TemplateEntityV1beta3['spec'], 'output'> & {
    output?: TemplateOutput;
  };
};

/**
 * Generates the central programmatic Scaffolder Template fixtures for the dev workspace sandbox.
 */
export function getWorkbenchScaffolderTemplates(): Entity[] {

  // 1. Baseline Hermetic Offline Test Template
  const offlineHelloWorldTemplate: WorkbenchTemplateEntity = {
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
        // The v1beta3 runtime schema requires `text` to be an array of
        // Markdown text blob objects, not a plain string.
        text: [
          {
            title: 'Scaffold Result',
            content:
              'Offline scaffold finished successfully for parameter name: ${{ parameters.name }}',
          },
        ],
      },
    },
  };

  // 2. Secondary AI-Crew-Suite Demo Template
  const aiAgentProvisionerTemplate: WorkbenchTemplateEntity = {
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
        // The v1beta3 runtime schema requires `text` to be an array of
        // Markdown text blob objects, not a plain string.
        text: [
          {
            title: 'Provisioning Result',
            content:
              'Your synthetic workspace agent **${{ parameters.agentName }}** is fully seeded and available under topology rules via routing cluster endpoint defaults.',
          },
        ],
      },
    },
  };

  return [
    offlineHelloWorldTemplate,
    aiAgentProvisionerTemplate,
  ];
}
