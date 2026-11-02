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
import { runImagePromote } from './src/promote';

/** Executes explicit registry-side image promotion. */
export default async function execute({ args, info }: CliCommandContext): Promise<void> {
  const program = new Command();
  program
    .name(info.usage)
    .description('Promote a published, structure-tested candidate by digest')
    .argument('<target>', 'Container package to promote')
    .addOption(new Option('-r, --registry <registry>', 'Target registry').env('REGISTRY').default('localhost:32443/ai-crew-suite'))
    .option('-t, --tag <tag>', 'Mutable promotion channel', 'latest')
    .option('--plain-http', 'Use HTTP for an insecure registry')
    .action(async (target, options) => {
      await runImagePromote({ target, registry: options.registry, tag: options.tag, plainHttp: options.plainHttp });
    });
  await program.parseAsync(args, { from: 'user' });
}
