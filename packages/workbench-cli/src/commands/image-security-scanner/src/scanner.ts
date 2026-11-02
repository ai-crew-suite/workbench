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
import os from 'node:os';
import path from 'node:path';
import chalk from 'chalk';
import { findRepoRoot, discoverContainerTargets, hasBinary } from '../../../utils/workspace';
import { readImageReceipt, withImageLock } from '../../../utils/oci/image-receipt';
import { runProcess } from '../../../utils/run-process';

export interface ScannerOptions {
  target?: string;
  scanTimeout: string;
}

/**
 * Executes a vulnerability scan against a target container image
 */
async function executeTrivyScan(targetName: string, targetDir: string, options: ScannerOptions, useLocalBinary: boolean): Promise<void> {
  await withImageLock(targetDir, async () => {
    const imageTag = readImageReceipt(targetDir, targetName).imageId;
    console.log(`🛡️  Scanning image [${chalk.cyan(imageTag)}] for high/critical security vulnerabilities...`);
    if (useLocalBinary) {
      await runProcess('trivy', [
        'image', '--timeout', options.scanTimeout, '--severity', 'HIGH,CRITICAL', '--exit-code', '1', imageTag
      ]);
    } else {
      console.log(chalk.yellow('⚠️  trivy binary not found on host. Running via Docker wrapper...'));
      const cacheMount = `${path.join(os.homedir(), '.cache', 'trivy')}:/root/.cache`;
      await runProcess('docker', [
        'run', '--rm', '-v', '/var/run/docker.sock:/var/run/docker.sock', '-v', cacheMount,
        'aquasec/trivy:latest', 'image', '--timeout', options.scanTimeout, '--severity', 'HIGH,CRITICAL',
        '--exit-code', '1', imageTag
      ]);
    }
  });
}

/**
 * Orchestrator Router for single targets or full security cascades
 */
export async function runSecurityScanner(options: ScannerOptions): Promise<void> {
  const repoRoot = findRepoRoot();
  const validTargets = discoverContainerTargets(repoRoot);
  const useLocalBinary = hasBinary('trivy');

  if (options.target) {
    const targetDir = validTargets.get(options.target);
    if (!targetDir) {
      console.error(chalk.red(`\n❌ Error: Invalid security scan target '${options.target}'.`));
      console.error(`👉 Available targets: ${chalk.cyan([...validTargets.keys()].join(', '))}\n`);
      throw new Error(`Target tracking mapping failure for ${options.target}`);
    }

    await executeTrivyScan(options.target, targetDir, options, useLocalBinary);
  } else {
    console.log(chalk.blue('🛡️  Commencing full security scan cascade across all images...\n'));

    for (const [targetName, targetDir] of validTargets.entries()) {
      console.log(chalk.bold(`🔒 Triggering security profile assessment for: ${chalk.yellow(targetName)}`));
      await executeTrivyScan(targetName, targetDir, options, useLocalBinary);
    }
  }

  console.log(chalk.green('\n✅ Security profile clear. No high or critical CVEs detected!'));
}
