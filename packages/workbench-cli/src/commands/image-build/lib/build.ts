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
import { existsSync, rmSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import chalk from 'chalk';
import * as tar from 'tar';
import { discoverContainerTargets, findRepoRoot } from '../../../utils/workspace.js';
import { DockerBuildService } from './docker-build-service.js';

export interface BuildOptions {
  target?: string;
  registry: string;
  imageTag: string;
}

export class ImageBuilder {
  constructor(private buildService = new DockerBuildService()) {}

  /**
   * Removes temporary artifacts and attempts to prune dangling images.
   */
  async executeCleanup(repoRoot: string, targetName: string): Promise<void> {
    const prunedDir = join(repoRoot, `out-${targetName}`);

    console.log(chalk.gray(
      `\n🧹 Sweeping up temporary build directories for ${targetName}...`
    ));

    if (existsSync(prunedDir)) {
      rmSync(prunedDir, { recursive: true, force: true });
    }

    console.log(chalk.gray(
      '✂️ Pruning dangling Docker images over Unix socket connection...'
    ));

    try {
      await this.buildService.pruneImages();
    } catch (error) {
      console.warn(chalk.yellow(
        '⚠️ Unable to prune dangling images; continuing without image cleanup:'
      ), error);
    }
  }

  /**
   * Extracts package configuration metadata to construct standard OCI label matrices
   */
  resolveMetadataLabels(targetName: string, targetDir: string): Record<string, string> {
    let pkgDescription = 'AI Crew Suite internal infrastructure container package';
    let pkgLicense = 'Apache-2.0';
    let pkgTitle = targetName;
    let pkgSource = 'https://github.com';

    try {
      const pkgJsonPath = join(targetDir, 'package.json');
      if (existsSync(pkgJsonPath)) {
        const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));

        if (pkg.description) pkgDescription = pkg.description;
        if (pkg.license) pkgLicense = pkg.license;
        if (pkg.name) pkgTitle = pkg.name;

        if (pkg.repository) {
          pkgSource = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository.url || pkgSource;
          pkgSource = pkgSource.replace(/^git\+/, '');
        }
      }
    } catch {
      // Fail silently and track standard defaults if JSON metadata is corrupt
    }

    return {
      'org.opencontainers.image.title': pkgTitle,
      'org.opencontainers.image.description': pkgDescription,
      'org.opencontainers.image.licenses': pkgLicense,
      'org.opencontainers.image.vendor': 'AI Crew Suite',
      'org.opencontainers.image.source': pkgSource,
    };
  }

  /**
   * Compiles a singular localized Docker target image
   */
  async compileImage(repoRoot: string, targetName: string, targetDir: string, options: BuildOptions): Promise<void> {
    const { imageTag } = options;
    const isCI = process.env['CI'] === 'true';
    const fullImageTag = `local/${targetName}:${imageTag}`;

    const relativeDockerfilePath = relative(repoRoot, join(targetDir, 'Dockerfile')).replace(/\\/g, '/');
    const labels = this.resolveMetadataLabels(targetName, targetDir);

    try {
      console.log(
        `\n📦 [${chalk.blue(targetName)}] Stream-packing build context to Docker Engine...`
      );

      // Compress workspace on the fly using a streaming layout to match build context conventions
      const contextStream = tar.c(
        {
          cwd: repoRoot,
          gzip: false, // Docker expects a raw un-gzip tar context layer stream
        },
        ['.']
      ) as any; // Explicit typecast resolves signature mismatch between tar.Pack and NodeJS.ReadableStream

      await this.buildService.build(contextStream, {
        t: fullImageTag,
        dockerfile: relativeDockerfilePath,
        labels,
      });

      console.log(chalk.green(
        `\n✅ ${targetName} image compiled successfully as: ${fullImageTag}`
      ));

      if (isCI) {
        console.log(chalk.blue(
          `🚀 CI context detected. Out-of-band streaming push triggered for: ${fullImageTag}`
        ));

        await this.buildService.pushImage(fullImageTag);
      }
    } finally {
      await this.executeCleanup(repoRoot, targetName);
    }
  }

  /**
   * Orchestrator Router for single targets or structural cascades
   */
  async execute(options: BuildOptions): Promise<void> {
    const repoRoot = findRepoRoot();
    const validTargets = discoverContainerTargets(repoRoot);

    if (options.target) {
      const targetDir = validTargets.get(options.target);

      if (!targetDir) {
        console.error(chalk.red(
          `\n❌ Error: Invalid or unreachable target package '${options.target}'.`
        ));

        console.error(
          `👉 Available options inside workspace: ${chalk.cyan([...validTargets.keys()].join(', '))}\n`
        );

        throw new Error(`Target tracking mapping failure for ${options.target}`);
      }

      await this.compileImage(repoRoot, options.target, targetDir, options);

    } else {
      console.log(chalk.blue(
        '🔄 No explicit target provided. Initiating a full structural build cascade...\n'
      ));

      for (const [targetName, targetDir] of validTargets.entries()) {
        console.log(chalk.bold(
          `\n🔨 Triggering build process for: ${chalk.yellow(targetName)}`
        ));

        await this.compileImage(repoRoot, targetName, targetDir, options);
      }
    }
  }
}

// Procedural proxy wrapper to sustain backward compatibility with Commander CLI layers
export async function runImagesBuild(options: BuildOptions): Promise<void> {
  const builder = new ImageBuilder();
  await builder.execute(options);
}
