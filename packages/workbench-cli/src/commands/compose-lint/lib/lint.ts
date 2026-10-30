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
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { DCLinter } from 'dclint';
import { findRepoRoot } from '../../../utils/workspace';

export interface ComposeLintOptions {
  target?: string;
}

/**
 * Searches a directory for standard docker compose filenames
 */
function findComposeFileInDir(dirPath: string): string | null {
  const candidates = [
    'compose.yml',
    'compose.yaml',
    'docker-compose.yml',
    'docker-compose.yaml',
    'src/compose.yml',
    'src/compose.yaml'
  ];

  for (const candidate of candidates) {
    const fullPath = path.join(dirPath, candidate);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

/**
 * Recursively discovers all docker compose targets across the repo root context,
 * bypassing node_modules, build distributions, or hidden metadata.
 */
function discoverComposeTargets(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (['node_modules', 'dist', 'build', '.git', '.turbo', '.yarn'].includes(file)) {
        continue;
      }
      discoverComposeTargets(filePath, fileList);
    } else if (['compose.yml', 'compose.yaml', 'docker-compose.yml', 'docker-compose.yaml'].includes(file)) {
      fileList.push(filePath);
    }
  }

  return fileList;
}

/**
 * Orchestrator Router for programmatic validation suites
 */
export async function runComposeLint(options: ComposeLintOptions): Promise<void> {
  const repoRoot = findRepoRoot();
  let filesToLint: string[] = [];

  if (options.target) {
    let targetPath = path.resolve(repoRoot, options.target);

    // Resolve directories to internal layout contexts automatically
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
      const foundFile = findComposeFileInDir(targetPath);
      if (!foundFile) {
        throw new Error(`No valid compose file target configuration found within directory: ${options.target}`);
      }
      targetPath = foundFile;
    }

    if (!fs.existsSync(targetPath)) {
      throw new Error(`Target tracking location failure for path: ${options.target}`);
    }

    console.log(`🔎 Commencing targeted compose analysis sweep on [${chalk.yellow(options.target)}]...`);
    filesToLint.push(targetPath);
  } else {
    console.log(chalk.blue('🔎 Commencing full static analysis cascade on all workspace Compose configurations...'));
    filesToLint = discoverComposeTargets(repoRoot);

    if (filesToLint.length === 0) {
      console.log(chalk.yellow('⚠️  No active Compose file targets discovered across project directory context.'));
      return;
    }

    console.log(chalk.gray(`Running execution context against ${filesToLint.length} configurations...\n`));
  }

  // Display files going into the engine pipeline loop
  for (const file of filesToLint) {
    const relativeDisplay = path.relative(repoRoot, file).replace(/\\/g, '/');
    console.log(`📋 Queued for validation: ${chalk.cyan(relativeDisplay)}`);
  }

  // Programmatic API Evaluation Sequence
  const linter = new DCLinter({
    rules: {},
    quiet: false,
    debug: false,
    exclude: []
  });

  // Arguments: files/dirs array, enableAutoFix boolean
  const lintResults = linter.lintFiles(filesToLint, false);

  // Format the diagnostic payload natively
  const formattedResults = await linter.formatResults(lintResults, 'stylish');

  if (formattedResults) {
    console.log(`\n${formattedResults}`);
  }

  // Scan issues matrix to calculate a strict runtime exit boundary code
  const errorCount = lintResults.reduce((acc, res) => acc + res.errorCount, 0);

  if (errorCount > 0) {
    throw new Error(`Compose engine verification failed with ${errorCount} schema rule breaks.`);
  }

  console.log(chalk.green('\n✅ Compose analysis clear. Structural layout configurations are syntactically sound!'));
}
