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
import { runComposePublish } from './lib/publish';

const program = new Command();

program
  .name('compose:publish')
  .description('Package and push the deploy compose configuration to Zot or GHCR as an OCI artifact')
  .addOption(new Option('-r, --registry <registry>', 'Target registry destination override').env('REGISTRY').default('localhost:32443/ai-crew-suite'))
  .addOption(new Option('-t, --tag <tag>', 'Artifact version tag').env('IMAGE_TAG').default('latest'))
  .option('--plain-http', 'Use HTTP for an insecure registry (automatic for localhost)')
  .action(async (options) => {
    try {
      console.log(`\n${chalk.cyan('┌────────────────────────────────────────────────────────┐')}`);
      console.log(`${chalk.cyan('│ 📦 WORKBENCH CLI: Compose OCI Artifact Pipeline        │')}`);
      console.log(`${chalk.cyan('└────────────────────────────────────────────────────────┘')}`);

      await runComposePublish({
        registry: options.registry,
        imageTag: options.tag,
        plainHttp: options.plainHttp,
      });

      process.exitCode = 0;
    } catch (error) {
      console.error(`\n${chalk.red('❌ Critical Compose Artifact Publishing Failure:')}`, error);
      process.exitCode = 1;
    }
  });

program.parse(process.argv);
