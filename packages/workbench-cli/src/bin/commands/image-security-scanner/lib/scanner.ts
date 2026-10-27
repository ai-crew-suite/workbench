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
import { spawnSync } from 'node:child_process';
import chalk from 'chalk';
import { findRepoRoot, discoverContainerTargets, hasBinary } from '../../../utils/workspace';

export interface ScannerOptions {
  target?: string;
  scanTimeout: string;
}

/**
 * Executes a vulnerability scan against a target container image
 */
function executeTrivyScan(targetName: string, options: ScannerOptions, useLocalBinary: boolean): void {
  const imageTag = `local/${targetName}:latest`;
  console.log(`🛡️  Scanning image [${chalk.cyan(imageTag)}] for high/critical security vulnerabilities...`);

  if (useLocalBinary) {
    const args = [
      'image',
      '--timeout', options.scanTimeout,
      '--severity', 'HIGH,CRITICAL',
      '--exit-code', '1',
      imageTag
    ];

    const result = spawnSync('trivy', args, { stdio: 'inherit' });
    if (result.status !== 0) {
      throw new Error(`Security validation checks found policy violations on target ${targetName}`);
    }
  } else {
    console.log(chalk.yellow('⚠️  trivy binary not found on host. Running via Docker wrapper...'));

    const userHome = os.homedir();
    const cacheMount = `${path.join(userHome, '.cache', 'trivy')}:/root/.cache`;

    const args = [
      'run', '--rm',
      '-v', '/var/run/docker.sock:/var/run/docker.sock',
      '-v', cacheMount,
      'aquasec/trivy:latest',
      'image',
      '--timeout', options.scanTimeout,
      '--severity', 'HIGH,CRITICAL',
      '--exit-code', '1',
      imageTag
    ];

    const result = spawnSync('docker', args, { stdio: 'inherit' });
    if (result.status !== 0) {
      throw new Error(`Security validation checks found policy violations on container bridge for target ${targetName}`);
    }
  }
}

/**
 * Orchestrator Router for single targets or full security cascades
 */
export async function runSecurityScanner(options: ScannerOptions): Promise<void> {
  const repoRoot = findRepoRoot();
  const validTargets = discoverContainerTargets(repoRoot);
  const useLocalBinary = hasBinary('trivy');

  if (options.target) {
    if (!validTargets.has(options.target)) {
      console.error(chalk.red(`\n❌ Error: Invalid security scan target '${options.target}'.`));
      console.error(`👉 Available targets: ${chalk.cyan([...validTargets.keys()].join(', '))}\n`);
      throw new Error(`Target tracking mapping failure for ${options.target}`);
    }

    executeTrivyScan(options.target, options, useLocalBinary);
  } else {
    console.log(chalk.blue('🛡️  Commencing full security scan cascade across all images...\n'));

    for (const targetName of validTargets.keys()) {
      console.log(chalk.bold(`🔒 Triggering security profile assessment for: ${chalk.yellow(targetName)}`));
      executeTrivyScan(targetName, options, useLocalBinary);
    }
  }

  console.log(chalk.green('\n✅ Security profile clear. No high or critical CVEs detected!'));
}
