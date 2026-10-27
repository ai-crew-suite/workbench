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
import { findRepoRoot, discoverContainerTargets } from '../../../utils/workspace';

export interface PublishOptions {
  target?: string;
  registry: string;
  imageTag: string;
}

/**
 * Handles image tagging and remote pushing orchestration routines
 */
function publishSingleImage(targetName: string, options: PublishOptions): void {
  const { registry, imageTag } = options;
  const localSourceTag = `local/${targetName}:${imageTag}`;

  // Scenario matching: determine naming schemas for Zot vs GHCR/External registries
  const isLocalZot = registry.startsWith('localhost') || registry.startsWith('127.0.0.1') || registry.includes('zot');

  const remoteTargetTag = isLocalZot
    ? `${registry}/${targetName}:${imageTag}`
    : `${registry}/workbench-${targetName}:${imageTag}`;

  console.log(`\n🏷️  Preparing distribution layers for [${chalk.yellow(targetName)}]...`);
  console.log(chalk.gray(`   Source: ${localSourceTag}`));
  console.log(chalk.gray(`   Remote: ${remoteTargetTag}`));

  // Step 1: Apply remote tracking tag configuration mapping
  console.log(chalk.blue(`🔄 Tagging image layers...`));
  const tagResult = spawnSync('docker', ['tag', localSourceTag, remoteTargetTag], { stdio: 'inherit' });
  if (tagResult.status !== 0) {
    throw new Error(`Failed to tag target container image for ${targetName}`);
  }

  // Step 2: Push compiled layer blobs to the target repository registry endpoints
  console.log(chalk.blue(`🚀 Streaming image packages to distribution registry...`));
  const pushResult = spawnSync('docker', ['push', remoteTargetTag], { stdio: 'inherit' });
  if (pushResult.status !== 0) {
    throw new Error(`Failed to push target container image layers to remote destination registry: ${remoteTargetTag}`);
  }

  console.log(chalk.green(`\n✅ Successfully published image package: ${remoteTargetTag}`));
}

/**
 * Orchestrator Router for single manual targets or cascading pipelines
 */
export async function runImagesPublish(options: PublishOptions): Promise<void> {
  const repoRoot = findRepoRoot();
  const validTargets = discoverContainerTargets(repoRoot);

  if (options.target) {
    if (!validTargets.has(options.target)) {
      console.error(chalk.red(`\n❌ Error: Invalid container publish target '${options.target}'.`));
      console.error(`👉 Available options inside workspace: ${chalk.cyan([...validTargets.keys()].join(', '))}\n`);
      throw new Error(`Target tracking mapping failure for ${options.target}`);
    }

    publishSingleImage(options.target, options);
  } else {
    console.log(chalk.blue('🔄 No explicit target provided. Initiating a full distribution cascade...\n'));

    for (const targetName of validTargets.keys()) {
      publishSingleImage(targetName, options);
    }
  }

  console.log(chalk.green('\n✨ All requested container distributions pushed successfully!'));
}
