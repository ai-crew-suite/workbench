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
import { createCliModule } from '@backstage/cli-node';
import type { CliCommand, CliCommandContext } from '@backstage/cli-node';
import { existsSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { findRepoRoot } from './utils/workspace';
import packageJson from '../package.json';

function command(
  pathSegments: string[],
  description: string,
  loader: () => Promise<{ default: (context: CliCommandContext) => Promise<void> }>,
): CliCommand {
  return {
    path: ['workbench', ...pathSegments],
    description,
    execute: {
      loader: async () => {
        const envPath = path.join(findRepoRoot(), '.env');
        if (existsSync(envPath)) {
          const result = dotenv.config({ path: envPath, quiet: true });
          if (result.error) {
            throw result.error;
          }
        }
        return loader();
      },
    },
  };
}

/** Workbench commands available to a Backstage CLI host. */
export default createCliModule({
  packageJson,
  init: async registry => {
    registry.addCommand(command(['code-generator'], 'Generate and register a plugin', () => import('./commands/code-generator')));
    registry.addCommand(command(['compose', 'lint'], 'Lint Docker Compose files', () => import('./commands/compose-lint')));
    registry.addCommand(command(['compose', 'publish'], 'Publish Docker Compose configuration', () => import('./commands/compose-publish')));
    registry.addCommand(command(['compose', 'start'], 'Start the shared Compose stack', () => import('./commands/compose-start')));
    registry.addCommand(command(['compose', 'stop'], 'Stop the shared Compose stack', () => import('./commands/compose-stop')));
    registry.addCommand(command(['image', 'build'], 'Build container images', () => import('./commands/image-build')));
    registry.addCommand(command(['image', 'lint'], 'Lint Dockerfiles', () => import('./commands/image-lint')));
    registry.addCommand(command(['image', 'publish'], 'Publish container images', () => import('./commands/image-publish')));
    registry.addCommand(command(['image', 'test', 'security'], 'Scan container images for vulnerabilities', () => import('./commands/image-security-scanner')));
    registry.addCommand(command(['image', 'test', 'structure'], 'Run container structure tests', () => import('./commands/image-test-structure')));
    registry.addCommand(command(['wiremock', 'seeder'], 'Seed WireMock mappings', () => import('./commands/wiremock-seeder')));
  },
});
