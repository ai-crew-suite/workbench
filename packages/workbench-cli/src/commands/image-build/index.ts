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
import { Command } from 'commander';
import chalk from 'chalk';
import type { CliCommandContext } from '@backstage/cli-node';
import { runImagesBuild } from './src/build';

/** Execute this command using arguments supplied by the Backstage CLI. */
export default async function execute({ args, info }: CliCommandContext): Promise<void> {
  const program = new Command();

  program
    .name(info.usage)
    .description('Build workspace container images and record their immutable identity')
    .argument('[target]', 'Specific container directory to build (omitting builds all targets sequentially)')
    .action(async target => {
      try {
        console.log(`\n${chalk.magenta('┌────────────────────────────────────────────────────────┐')}`);
        console.log(`${chalk.magenta('│ 🐳 WORKBENCH CLI: Container Compilation Sequence       │')}`);
        console.log(`${chalk.magenta('└────────────────────────────────────────────────────────┘')}`);

        await runImagesBuild({ target });

      } catch (error) {
        console.error(`\n${chalk.red('❌ Critical Engine Orchestration Failure:')}`, error);
        throw error;
      }
    });

  await program.parseAsync(args, { from: 'user' });
}
