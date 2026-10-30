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
import { existsSync, statSync } from 'node:fs';
import dotenv from 'dotenv';
import { findRepoRoot } from './utils/workspace.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  const repoRoot = findRepoRoot(__dirname);
  const envFilePath = path.join(repoRoot, '.env');
  if (existsSync(envFilePath) && statSync(envFilePath).isFile()) {
    dotenv.config({ path: envFilePath });
  }
} catch {
  console.warn('⚠️  Workbench CLI: Bypassed programmatic .env loading hook.');
}

process.env['FORCE_COLOR'] = '3';
chalk.level = 3;

const program = new Command();

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
    'compose:lint',
    'Lint Docker compose files',
    createCommandOpts('compose-lint'),
  )
  .command(
    'compose:publish',
    'Publish Docker compose services',
    createCommandOpts('compose-publish'),
  )
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
    'image:publish',
    'Tag and push compiled monorepo container images to target registries',
    createCommandOpts('image-publish'),
  )
  .command(
    'image:test:security',
    'Scan built container images for High and Critical CVE vulnerabilities using trivy',
    createCommandOpts('image-security-scanner'),
  )
  .command(
    'image:test:structure',
    'Execute declarative container structure tests using configuration blueprints',
    createCommandOpts('image-test-structure'),
  )
  .command(
    'wiremock:seeder',
    'Seed running WireMock instances with programmatic vendor mock blueprints or localized rule files',
    createCommandOpts('wiremock-seeder'),
  );

program.parse(process.argv);
