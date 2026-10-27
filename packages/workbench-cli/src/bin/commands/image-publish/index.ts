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
import { runImagesPublish } from './lib/publish';

const program = new Command();

program
  .name('image:publish')
  .description('Manually tag and push built container images to Zot or GHCR distribution registries')
  .argument('[target]', 'Specific container package directory to push (omitting pushes all targets sequentially)')
  .addOption(new Option('-r, --registry <registry>', 'Target registry destination override').env('REGISTRY').default('localhost:32443/ai-crew-suite'))
  .addOption(new Option('-t, --tag <tag>', 'Docker image tag version').env('IMAGE_TAG').default('latest'))
  .action(async (target, options) => {
    try {
      console.log(`\n${chalk.magenta('┌────────────────────────────────────────────────────────┐')}`);
      console.log(`${chalk.magenta('│ 🚀 WORKBENCH CLI: Container Distribution Pipeline       │')}`);
      console.log(`${chalk.magenta('└────────────────────────────────────────────────────────┘')}`);

      await runImagesPublish({
        target,
        registry: options.registry,
        imageTag: options.tag,
      });

      process.exitCode = 0;
    } catch (error) {
      console.error(`\n${chalk.red('❌ Critical Engine Publishing Failure:')}`, error);
      process.exitCode = 1;
    }
  });

program.parse(process.argv);
