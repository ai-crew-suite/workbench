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
import { hasBinary, discoverContainerTargets, findRepoRoot } from '../../../utils/workspace';

export interface LintOptions {
  target?: string;
}

/**
 * Executes static analysis on a single target file path
 */
export function lintSingleFile(repoRoot: string, targetName: string, dockerfilePath: string, useLocalHadolint: boolean): void {
  const relativeDisplay = path.relative(repoRoot, dockerfilePath).replace(/\\/g, '/');
  console.log(`🔎 Analyzing: ${chalk.cyan(relativeDisplay)}`);

  if (!fs.existsSync(dockerfilePath)) {
    throw new Error(`Dockerfile not found at target location: ${dockerfilePath}`);
  }

  if (useLocalHadolint) {
    const result = spawnSync('hadolint', [dockerfilePath], { stdio: 'inherit' });
    if (result.status !== 0) {
      throw new Error(`Lint verification failed on target ${targetName}`);
    }
  } else {
    // Falls back to sequential streaming containers using the Docker Engine runtime pipeline
    const dockerfileBuffer = fs.readFileSync(dockerfilePath);
    const result = spawnSync('docker', ['run', '--rm', '-i', 'hadolint/hadolint'], {
      input: dockerfileBuffer,
      stdio: ['pipe', 'inherit', 'inherit'], // Pipe standard input buffer, forward stdout/stderr safely
    });

    if (result.status !== 0) {
      throw new Error(`Lint verification failed on container fallback for target ${targetName}`);
    }
  }
}

/**
 * Orchestrator Router for single targets or full static analysis cascades
 */
export async function runImagesLint(options: LintOptions): Promise<void> {
  const repoRoot = findRepoRoot();
  const validTargets = discoverContainerTargets(repoRoot);
  const useLocalHadolint = hasBinary('hadolint');

  if (options.target) {
    const targetDir = validTargets.get(options.target);
    if (!targetDir) {
      console.error(chalk.red(`\n❌ Error: Invalid lint target '${options.target}'.`));
      console.error(`👉 Available options inside workspace: ${chalk.cyan([...validTargets.keys()].join(', '))}\n`);
      throw new Error(`Target tracking mapping failure for ${options.target}`);
    }

    console.log(`🔎 Commencing targeted static analysis sweep on [${chalk.yellow(options.target)}]...`);
    const dockerfilePath = path.join(targetDir, 'Dockerfile');
    lintSingleFile(repoRoot, options.target, dockerfilePath, useLocalHadolint);
  } else {
    console.log(chalk.blue('🔎 Commencing full static analysis cascade on all Dockerfiles...'));

    if (useLocalHadolint) {
      // Optimization: Feed all discovered filepaths concurrently directly to our local binary
      const allDockerfiles = Array.from(validTargets.values()).map((dir) => path.join(dir, 'Dockerfile'));

      if (allDockerfiles.length === 0) {
        console.log(chalk.yellow('⚠️  No active Dockerfile targets discovered across project directory context.'));
        return;
      }

      console.log(chalk.gray(`Running parallel execution map against ${allDockerfiles.length} paths...`));
      const result = spawnSync('hadolint', allDockerfiles, { stdio: 'inherit' });

      if (result.status !== 0) {
        throw new Error('Lint cascade verification suite encountered validation failures.');
      }
    } else {
      console.log(chalk.yellow('⚠️  hadolint binary not found on host. Falling back to sequential Docker containers...'));

      for (const [targetName, targetDir] of validTargets.entries()) {
        const dockerfilePath = path.join(targetDir, 'Dockerfile');
        lintSingleFile(repoRoot, targetName, dockerfilePath, false);
      }
    }
  }

  console.log(chalk.green('\n✅ Static analysis clear. Structural code is syntactically sound!'));
}
