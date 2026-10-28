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
import path from 'node:path';
import fs from 'node:fs';
import chalk from 'chalk';
import { findRepoRoot, discoverContainerTargets } from '../../../utils/workspace';
import { resolveTargetTags, normalizeTargetName } from './registry-utils';
import { DockerService } from './docker-service';
import { SigningService } from './signing-service';

export interface PublishOptions {
  target?: string;
  registry: string;
  imageTag: string;
}

const isCI = process.env['CI'] === 'true';

export class ImagePublisher {
  constructor(
    private dockerService = new DockerService(),
    private signingService = new SigningService()
  ) {}

  async publishSingleImage(targetName: string, options: PublishOptions): Promise<void> {
    const { registry, imageTag } = options;
    const { localSourceTag, remoteTargetTag } = resolveTargetTags(targetName, registry, imageTag);

    console.log(`\n🏷️  Preparing distribution layers for [${chalk.yellow(targetName)}]...`);
    await this.dockerService.tagImage(localSourceTag, remoteTargetTag);

    console.log(chalk.blue(`🚀 Streaming image packages to distribution registry via Dockerode...`));
    const remoteTargetDigest = await this.dockerService.pushImage(remoteTargetTag);
    console.log(chalk.green(`\n✅ Successfully published image package: ${remoteTargetDigest}`));

    const repoRoot = findRepoRoot(process.cwd());
    const keyPath = path.resolve(repoRoot, 'cosign.key');
    const cosignPass = process.env['COSIGN_PASSWORD'];

    if (isCI || (fs.existsSync(keyPath) && cosignPass)) {
      console.log(chalk.cyan(`\n🔏 Cryptographically signing image via Native Sigstore SDK...`));
      console.log(chalk.gray(`   Identity strategy: ${isCI ? 'Keyless OIDC Token Exchange' : 'Local Static Keypair'}`));

      await this.signingService.signDigest(remoteTargetDigest, {
        isCI,
        keyPath,
        cosignPass,
      });

      console.log(chalk.green(`🔑 Cryptographic signature verified and attached to Zot container context!`));
    } else {
      console.log(chalk.gray(`\nℹ️  Skipping image signing: Sign conditions not met.`));
    }
  }
}

export async function runImagesPublish(options: PublishOptions): Promise<void> {
  const repoRoot = findRepoRoot();
  const validTargets = discoverContainerTargets(repoRoot);
  const publisher = new ImagePublisher();

  if (options.target) {
    const parsedTarget = normalizeTargetName(options.target);

    if (!validTargets.has(parsedTarget)) {
      console.error(chalk.red(`\n❌ Error: Invalid container publish target '${options.target}'.`));
      throw new Error(`Target tracking mapping failure for ${options.target}`);
    }
    await publisher.publishSingleImage(parsedTarget, options);
  } else {
    for (const targetName of validTargets.keys()) {
      await publisher.publishSingleImage(targetName, options);
    }
  }
}
