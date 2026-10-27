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
import { existsSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import chalk from 'chalk';
import { discoverContainerTargets, findRepoRoot } from '../../../utils/workspace';

export interface BuildOptions {
  target?: string;
  registry: string;
  imageTag: string;
}

/**
 * Sweeps up temporary artifacts and prunes dangling system layers safely
 */
function executeCleanup(repoRoot: string, targetName: string): void {
  const prunedDir = join(repoRoot, `out-${targetName}`);

  console.log(chalk.gray(`\n🧹 Sweeping up temporary build directories for ${targetName}...`));
  if (existsSync(prunedDir)) {
    rmSync(prunedDir, { recursive: true, force: true });
  }

  console.log(chalk.gray('✂️ Pruning dangling Docker images...'));

  // Utilizing spawnSync to cleanly align with internal orchestrator testing mocks
  spawnSync('docker', ['image', 'prune', '-f'], { stdio: 'ignore' });
}

/**
 * Compiles a singular localized Docker target image
 */
function compileImage(repoRoot: string, targetName: string, targetDir: string, options: BuildOptions): void {
  const { imageTag } = options;
  const isCI = process.env['CI'] === 'true';
  const buildAction = isCI ? '--push' : '--load';
  const fullImageTag = `local/${targetName}:${imageTag}`;

  const relativeDockerfilePath = relative(repoRoot, join(targetDir, 'Dockerfile')).replace(/\\/g, '/');

  let pkgDescription = 'AI Crew Suite internal infrastructure container package';
  let pkgLicense = 'Apache-2.0';
  let pkgTitle = targetName;
  let pkgSource = 'https://github.com/ai-crew-suite/workbench';

  try {
    const pkgJsonPath = join(targetDir, 'package.json');
    if (existsSync(pkgJsonPath)) {
      const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
      if (pkg.description) pkgDescription = pkg.description;
      if (pkg.license) pkgLicense = pkg.license;
      if (pkg.name) pkgTitle = pkg.name;

      // Extract the formal Git repository URL target
      if (pkg.repository) {
        pkgSource = typeof pkg.repository === 'string'
          ? pkg.repository
          : pkg.repository.url || pkgSource;

        // Normalize git+https prefix variants if present in package configuration
        pkgSource = pkgSource.replace(/^git\+/, '');
      }
    }
  } catch {
    // Fail silently and use baseline defaults if JSON is malformed
  }

  try {
    console.log(`\n📦 [${chalk.blue(targetName)}] Passing build context to Docker Engine...`);

    const args = [
      'buildx', 'build',
      buildAction,
      '-t', fullImageTag,
      '-f', relativeDockerfilePath,
      '--label', `org.opencontainers.image.title=${pkgTitle}`,
      '--label', `org.opencontainers.image.description=${pkgDescription}`,
      '--label', `org.opencontainers.image.licenses=${pkgLicense}`,
      '--label', `org.opencontainers.image.vendor=AI Crew Suite`,
      '--label', `org.opencontainers.image.source=${pkgSource}`,
      '.'
    ];

    const result = spawnSync('docker', args, {
      cwd: repoRoot,
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '3' }
    });

    if (result.status !== 0) {
      throw new Error(`Docker compilation process failed with exit code ${result.status}`);
    }

    console.log(chalk.green(`\n✅ ${targetName} image compiled successfully as: ${fullImageTag}`));
  } finally {
    executeCleanup(repoRoot, targetName);
  }
}

/**
 * Orchestrator Router for single targets or structural cascades
 */
export async function runImagesBuild(options: BuildOptions): Promise<void> {
  const repoRoot = findRepoRoot();
  const validTargets = discoverContainerTargets(repoRoot);

  if (options.target) {
    const targetDir = validTargets.get(options.target);

    if (!targetDir) {
      console.error(chalk.red(`\n❌ Error: Invalid or unreachable target package '${options.target}'.`));
      console.error(`👉 Available options inside workspace: ${chalk.cyan([...validTargets.keys()].join(', '))}\n`);
      throw new Error(`Target tracking mapping failure for ${options.target}`);
    }

    compileImage(repoRoot, options.target, targetDir, options);
  } else {
    console.log(chalk.blue('🔄 No explicit target provided. Initiating a full structural build cascade...\n'));

    for (const [targetName, targetDir] of validTargets.entries()) {
      console.log(chalk.bold(`\n🔨 Triggering build process for: ${chalk.yellow(targetName)}`));
      compileImage(repoRoot, targetName, targetDir, options);
    }
  }
}
