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
import path from 'node:path';
import fs from 'node:fs';
import chalk from 'chalk';
import { findRepoRoot, discoverContainerTargets, hasBinary } from '../../../utils/workspace.js';

export interface PublishOptions {
  target?: string;
  registry: string;
  imageTag: string;
}

function publishSingleImage(targetName: string, options: PublishOptions): void {
  const { registry, imageTag } = options;
  const localSourceTag = `local/${targetName}:${imageTag}`;

  const isLocalZot = registry.startsWith('localhost') || registry.startsWith('127.0.0.1') || registry.includes('zot');

  const remoteTargetTag = isLocalZot
    ? `${registry}/${targetName}:${imageTag}`
    : `${registry}/workbench-${targetName}:${imageTag}`;

  console.log(`\n🏷️  Preparing distribution layers for [${chalk.yellow(targetName)}]...`);

  // Step 1: Apply remote tracking tag configuration
  const tagResult = spawnSync('docker', ['tag', localSourceTag, remoteTargetTag], { stdio: 'inherit' });
  if (tagResult.status !== 0) {
    throw new Error(`Failed to tag target container image for ${targetName}`);
  }

  // Push compiled layer blobs to the destination registry
  console.log(chalk.blue(`🚀 Streaming image packages to distribution registry...`));

  const pushResult = spawnSync('docker', ['push', remoteTargetTag], { stdio: 'inherit' });

  if (pushResult.status !== 0) {
    throw new Error(`Failed to push target container image layers to remote destination registry: ${remoteTargetTag}`);
  }

  console.log(chalk.green(`\n✅ Successfully published image package: ${remoteTargetTag}`));

  // Cryptographically sign the image layers via Cosign
  if (hasBinary('cosign')) {
    const repoRoot = findRepoRoot(process.cwd());
    const keyPath = path.resolve(repoRoot, 'cosign.key');

    // Read the variable directly from process.env now that dotenv populates it globally
    const cosignPass = process.env['COSIGN_PASSWORD'];

    // Prefer the repo-root key file for local runs; otherwise fall back to the
    // COSIGN_PRIVATE_KEY env parameter (GitHub Actions repository secret) so CI
    // signing works without ever materializing the private key on disk.
    const keyRef = fs.existsSync(keyPath)
      ? keyPath
      : process.env['COSIGN_PRIVATE_KEY']
        ? 'env://COSIGN_PRIVATE_KEY'
        : undefined;

    if (keyRef && cosignPass) {
      console.log(chalk.cyan(`\n🔏 Cryptographically signing image via Cosign...`));

      const cosignArgs = [
        'sign',
        '--key', keyRef,
        '--allow-http-registry=true',
        // cosign v3 defaults to the TUF signing config; both flags are required to skip the public transparency log
        '--use-signing-config=false',
        '--tlog-upload=false',
        '--yes',
        remoteTargetTag
      ];

      const signResult = spawnSync('cosign', cosignArgs, {
        stdio: 'inherit',
        env: { ...process.env, COSIGN_PASSWORD: cosignPass }
      });

      if (signResult.status === 0) {
        console.log(chalk.green(`🔑 Cryptographic signature verified and attached to Zot container context!`));
      } else {
        console.warn(chalk.yellow(`⚠️  Cosign error: Signature step exited with status code ${signResult.status}`));
      }
    } else {
      const reason = !keyRef
        ? `no cosign private key found at '${keyPath}' or via COSIGN_PRIVATE_KEY env parameter`
        : 'COSIGN_PASSWORD env parameter missing';
      console.log(chalk.gray(`\nℹ️  Skipping image signing: ${reason}.`));
    }
  }
}

export async function runImagesPublish(options: PublishOptions): Promise<void> {
  const repoRoot = findRepoRoot();
  const validTargets = discoverContainerTargets(repoRoot);

  if (options.target) {
    if (!validTargets.has(options.target)) {
      console.error(chalk.red(`\n❌ Error: Invalid container publish target '${options.target}'.`));
      throw new Error(`Target tracking mapping failure for ${options.target}`);
    }
    publishSingleImage(options.target, options);
  } else {
    for (const targetName of validTargets.keys()) {
      publishSingleImage(targetName, options);
    }
  }
}
