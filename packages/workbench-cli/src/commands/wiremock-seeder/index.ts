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
// packages/workbench-cli/src/bin/commands/seed-wiremock/index.ts
import { Command, Option } from 'commander';
import chalk from 'chalk';
import { runWiremockSeeder } from './lib/seeder';

const program = new Command();

program
  .name('seed:wiremock')
  .description('Seed running WireMock instances with programmatic vendor mock blueprints or localized rule files')
  .argument('[source]', 'Target workspace fixture group ("external", "kubernetes") or a local filesystem pathway to a JSON mapping file')
  .addOption(new Option('-p, --port <port>', 'Target port destination for the WireMock admin service API').env('WIREMOCK_PORT').default('8080'))
  .addOption(new Option('-h, --host <host>', 'Host networking resolution destination for the execution context').env('WIREMOCK_HOST').default('localhost'))
  .addOption(new Option('--clear', 'Completely reset and sweep away all active dynamic mock definitions prior to executing the seed ingestion payload').default(false))
  .action(async (source, options) => {
    try {
      console.log(`\n${chalk.cyan('┌────────────────────────────────────────────────────────┐')}`);
      console.log(`${chalk.cyan('│ 🤖 WORKBENCH CLI: WireMock Fixture Seeding Engine      │')}`);
      console.log(`${chalk.cyan('└────────────────────────────────────────────────────────┘')}`);

      await runWiremockSeeder({
        source: source || 'external',
        port: options.port,
        host: options.host,
        clear: options.clear,
      });

      process.exitCode = 0;
    } catch (error) {
      console.error(`\n${chalk.red('❌ Critical Seeding Execution Context Failure:')}`, error);
      process.exitCode = 1;
    }
  });

program.parse(process.argv);
