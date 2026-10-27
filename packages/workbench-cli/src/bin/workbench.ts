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
import { Command, Option, type ExecutableCommandOptions } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env['FORCE_COLOR'] = '3';
chalk.level = 3;

const program = new Command();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

program
  .name('workbench')
  .description(`\n  ${chalk.bold('Unified DevOps scripting toolkit for ai-crew-suite')}`)
  .version('1.0.0');

program.addHelpText('before', [
  chalk.magenta('┌────────────────────────────────────────────────────────┐'),
  chalk.magenta('│ 🧰 AI CREW SUITE: Internal Developer Toolbelt CLI      │'),
  chalk.magenta('└────────────────────────────────────────────────────────┘')
].join('\n'));

program.configureHelp({
  styleTitle: (str: string) => chalk.bold.magenta(str),
  styleCommandText: (str: string) => chalk.green(str),
  styleOptionText: (str: string) => chalk.blue(str),

  subcommandDescription: (cmd: Command) => chalk.gray(cmd.description()),
  subcommandTerm: (cmd: Command) => `  ${chalk.bold(cmd.name().padEnd(14))}`,

  optionDescription: (opt: Option) => chalk.gray(opt.description),
  optionTerm: (opt: Option) => `  ${chalk.bold(opt.flags.padEnd(14))}`,
});

const createCommandOpts = (command: string): ExecutableCommandOptions => ({
  executableFile: path.resolve(__dirname, `commands/${command}/index.js`),
});

program.configureOutput({
  getOutHasColors: () => true,
  getErrHasColors: () => true,
});

program
  .command(
    'image:build',
    'Build and package monorepo container targets',
    createCommandOpts('image-build'),
  )
  .command(
    'image:lint',
    'Perform static analysis on Dockerfile targets using hadolint',
    createCommandOpts('image-lint'),
  )
  .command(
    'image:test-structure',
    'Execute declarative container structure tests using configuration blueprints',
    createCommandOpts('image-test-structure'),
  );

program.parse(process.argv);
