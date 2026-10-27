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
import { runSecurityScanner } from './lib/scanner';

const program = new Command();

program
  .name('image:security-scanner')
  .description('Audit container image layers for high/critical security vulnerability contexts')
  .argument('[target]', 'Specific container directory package to scan (omitting runs all targets sequentially)')
  .addOption(new Option('-t, --timeout <timeout>', 'Global query execution time limit before aborting').env('TRIVY_SCAN_TIMEOUT').default('15m'))
  .action(async (target, options) => {
    try {
      console.log(`\n${chalk.magenta('┌────────────────────────────────────────────────────────┐')}`);
      console.log(`${chalk.magenta('│ 🛡️  WORKBENCH CLI: Security Vulnerability Audit        │')}`);
      console.log(`${chalk.magenta('└────────────────────────────────────────────────────────┘')}`);

      await runSecurityScanner({
        target,
        scanTimeout: options.timeout,
      });

      process.exitCode = 0;
    } catch (error) {
      console.error(`\n${chalk.red('❌ Critical Engine Orchestration Failure:')}`, error);
      process.exitCode = 1;
    }
  });

program.parse(process.argv);
