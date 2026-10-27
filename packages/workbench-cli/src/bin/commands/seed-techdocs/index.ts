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
import { syncProjectReferences } from './lib/sync';

const program = new Command();

program
  .name('sync:refs')
  .description('Synchronize all TypeScript package project references and heal the root configuration')
  .action(() => {
    try {
      console.log(`\n${chalk.blue('🔄 AI CREW SUITE: Healing monorepo TypeScript project references...')}`);

      syncProjectReferences();

      console.log(`${chalk.green('✅ Project reference mappings aligned perfectly!')}\n`);
      process.exitCode = 0;
    } catch (error) {
      console.error(chalk.red('❌ Core reference sync orchestration framework error:'), error);
      process.exitCode = 1;
    }
  });

program.parse(process.argv);
