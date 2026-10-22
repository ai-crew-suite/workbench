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
  .name('crew')
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
    'build',
    'Compile all workspace targets',
    createCommandOpts('build'),
  )
  .command(
    'clean',
    'Wipe internal build caches and distribution directories',
    createCommandOpts('clean'),
  )
  .command(
    'format',
    'Run automated text style formatting across the workspace layout via Prettier',
    createCommandOpts('format'),
  )
  .command(
    'lint',
    'Run structural ESLint validations',
    createCommandOpts('lint'),
  )
  .command(
    'publish',
    'Orchestrate npm release flow for modified targets',
    createCommandOpts('publish'),
  )
  .command(
    'storybook',
    'Boot up the localized interactive Storybook documentation server',
    createCommandOpts('storybook'),
  )
  .command(
    'storybook:build',
    'Compile a static distribution build of the workspace documentation stories',
    createCommandOpts('storybook-build'),
  )
  .command(
    'sync:refs',
    'Synchronize all TypeScript package project references and heal the root configuration',
    createCommandOpts('sync-refs'),
  )
  .command(
    'test:e2e',
    'Run end-to-end integration tests via Playwright',
    createCommandOpts('test-e2e'),
  )
  .command(
    'test:unit',
    'Execute package testing matrix',
    createCommandOpts('test-unit'),
  )
  .command(
    'test:unit:coverage',
    'Execute package unit tests matrix and write coverage metric distribution files',
    createCommandOpts('test-unit-coverage'),
  )
  .command(
    'typecheck',
    'Perform static TypeScript verification',
    createCommandOpts('typecheck'),
  );

program.parse(process.argv);
