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
import { spawnSync } from 'node:child_process';
import chalk from 'chalk';
import Docker from 'dockerode';
import { discoverContainerTargets, findRepoRoot } from '../../../utils/workspace';
import { readImageReceipt, structureConfigDigest, structureConfigPath, withImageLock, writeImageReceipt } from '../../../utils/oci/image-receipt';
import { runProcess } from '../../../utils/run-process';

/** Target selection for structure tests. */
export interface StructureTestOptions {
  target?: string;
}

/**
 * Checks if a specific command binary exists on the host machine path environment
 */
function hasBinary(binaryName: string): boolean {
  const checkCmd = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(checkCmd, [binaryName], { stdio: 'ignore' });
  return result.status === 0;
}

/** Runs the target's structure test against an exact local ID or registry digest. */
export async function testImageStructure(targetName: string, configFile: string, imageRef: string, useLocalBinary = hasBinary('container-structure-test')): Promise<void> {
  console.log(`🧱 Validating container structure for [${chalk.yellow(targetName)}] -> ${chalk.cyan(configFile)}...`);
  if (useLocalBinary) {
    await runProcess('container-structure-test', ['test', '--image', imageRef, '--config', configFile]);
  } else {
    console.log(chalk.yellow('⚠️  container-structure-test binary not found. Executing via Docker...'));
    await runProcess('docker', [
      'run', '--rm', '-v', '/var/run/docker.sock:/var/run/docker.sock',
      '-v', `${configFile}:/config.yaml`, 'gcr.io/container-structure-test/container-structure-test:latest',
      'test', '--image', imageRef, '--config', '/config.yaml'
    ]);
  }
}

async function executeStructureTest(targetName: string, targetDir: string, useLocalBinary: boolean): Promise<void> {
  await withImageLock(targetDir, async () => {
    const receipt = readImageReceipt(targetDir, targetName);
    const configFile = structureConfigPath(targetDir);
    const configDigest = structureConfigDigest(configFile);
    delete receipt.structureTest;
    delete receipt.publicationTests;
    writeImageReceipt(targetDir, receipt);
    const inspection = await new Docker().getImage(receipt.imageId).inspect();
    if (inspection.Id !== receipt.imageId) throw new Error(`Local image identity mismatch for ${targetName}.`);
    await testImageStructure(targetName, configFile, receipt.imageId, useLocalBinary);
    if (configDigest !== structureConfigDigest(configFile)) {
      throw new Error(`Structure test configuration changed during the test for ${targetName}.`);
    }
    receipt.structureTest = { imageId: receipt.imageId, configDigest };
    writeImageReceipt(targetDir, receipt);
  });
}

/**
 * Orchestrator Router for single targets or full testing cascades
 */
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

    await executeStructureTest(options.target, targetDir, useLocalBinary);
  } else {
    console.log(chalk.blue('🧱 Commencing full container structure validation cascade...'));

    for (const [targetName, targetDir] of validTargets.entries()) {
      await executeStructureTest(targetName, targetDir, useLocalBinary);
    }
  }

  console.log(chalk.green('\n✅ All structural configurations match expectations!'));
}
