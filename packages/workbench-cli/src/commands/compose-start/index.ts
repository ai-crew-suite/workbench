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
import { Command, Option } from 'commander';
import type { CliCommandContext } from '@backstage/cli-node';
import { startCompose } from './src/runner';

/** Starts the requested foreground development server and its shared stack. */
export default async function execute({ args, info }: CliCommandContext): Promise<void> {
  const program = new Command();
  program
    .name(info.usage)
    .description('Start the shared Compose stack and an app or backend development server')
    .argument('<target>', 'Development server: app or backend')
    .addOption(new Option('-r, --registry <registry>', 'OCI registry and namespace').env('REGISTRY').default('ghcr.io/ai-crew-suite'))
    .addOption(new Option('-t, --tag <tag>', 'Compose artifact tag').env('IMAGE_TAG').default('latest'))
    .option('--plain-http', 'Use HTTP for an insecure registry (automatic for localhost)')
    .action(async (target: string, options: { registry: string; tag: string; plainHttp?: boolean }) => {
      if (target !== 'app' && target !== 'backend') throw new Error('Target must be app or backend.');
      await startCompose({ target, ...options });
    });
  await program.parseAsync(args, { from: 'user' });
}
