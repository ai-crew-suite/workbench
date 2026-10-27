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
import { spawnSync } from 'node:child_process';
import chalk from 'chalk';
import { findRepoRoot, discoverContainerTargets, hasBinary } from '../../../../utils/workspace';

export interface StructureTestOptions {
  target?: string;
  registry: string;
}

function executeStructureTest(targetName: string, targetDir: string, options: StructureTestOptions, useLocalBinary: boolean): void {
  const configFile = path.join(targetDir, '__tests__', `${targetName}.cst.yaml`);
  const imageRef = `${options.registry}/workbench-${targetName}:latest`;

  if (!fs.existsSync(configFile)) {
    console.log(chalk.gray(`ℹ️  No structural test blueprint found at ${path.basename(configFile)}, skipping.`));
    return;
  }

  console.log(`🧱 Validating container structure for [${chalk.yellow(targetName)}] -> ${chalk.cyan(targetName + '.cst.yaml')}...`);

  if (useLocalBinary) {
    const result = spawnSync('container-structure-test', [
      'test',
      '--image', imageRef,
      '--config', configFile
    ], { stdio: 'inherit' });

    if (result.status !== 0) {
      throw new Error(`Structural assertions failed on local binary execution for target ${targetName}`);
    }
  } else {
    console.log(chalk.yellow('⚠️  container-structure-test binary not found. Executing via Docker...'));

    const args = [
      'run', '--rm',
      '-v', '/var/run/docker.sock:/var/run/docker.sock',
      '-v', `${configFile}:/config.yaml`,
      'gcr.io/container-structure-test/container-structure-test:latest',
      'test',
      '--image', imageRef,
      '--config', '/config.yaml'
    ];

    const result = spawnSync('docker', args, { stdio: 'inherit' });

    if (result.status !== 0) {
      throw new Error(`Structural assertions failed on Docker runtime container bridge for target ${targetName}`);
    }
  }
}

export async function runStructureTests(options: StructureTestOptions): Promise<void> {
  const repoRoot = findRepoRoot();
  const validTargets = discoverContainerTargets(repoRoot);
  const useLocalBinary = hasBinary('container-structure-test');

  if (options.target) {
    const targetDir = validTargets.get(options.target);
    if (!targetDir) {
      console.error(chalk.red(`\n❌ Error: Invalid structure test target '${options.target}'.`));
      console.error(`👉 Available options inside workspace: ${chalk.cyan([...validTargets.keys()].join(', '))}\n`);
      throw new Error(`Target tracking mapping failure for ${options.target}`);
    }

    executeStructureTest(options.target, targetDir, options, useLocalBinary);
  } else {
    console.log(chalk.blue('🧱 Commencing full container structure validation cascade...'));

    for (const [targetName, targetDir] of validTargets.entries()) {
      executeStructureTest(targetName, targetDir, options, useLocalBinary);
    }
  }

  console.log(chalk.green('\n✅ All structural configurations match expectations!'));
}
