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
import chalk from 'chalk';
import { runStructureTests } from './lib/test-structure';

const program = new Command();

program
  .name('image:test-structure')
  .description('Validate built image compliance profiles against declarative .cst.yaml tests')
  .argument('[target]', 'Specific container directory package to validate (omitting runs all targets sequentially)')
  .addOption(new Option('-r, --registry <registry>', 'Container registry path source').env('REGISTRY').default('localhost:32443/ai-crew-suite'))
  .action(async (target, options) => {
    try {
      console.log(`\n${chalk.magenta('┌────────────────────────────────────────────────────────┐')}`);
      console.log(`${chalk.magenta('│ 🧱 WORKBENCH CLI: Container Structure Assertions       │')}`);
      console.log(`${chalk.magenta('└────────────────────────────────────────────────────────┘')}`);

      await runStructureTests({
        target,
        registry: options.registry,
      });

      process.exitCode = 0;
    } catch (error) {
      console.error(`\n${chalk.red('❌ Critical Engine Orchestration Failure:')}`, error);
      process.exitCode = 1;
    }
  });

program.parse(process.argv);
