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
import { findRepoRoot, discoverContainerTargets, hasBinary } from '../../../utils/workspace';
import { normalizeTargetName, SigningService } from '../../../utils/oci';
import { ImageRegistry } from '../../../utils/oci/image-registry';
import { readImageReceipt, requireStructureTest, structureConfigDigest, structureConfigPath, withImageLock, writeImageReceipt } from '../../../utils/oci/image-receipt';
import { testImageStructure } from '../../image-test-structure/src/test-structure';
import { DockerService } from './docker-service';

/** Registry and target selection for candidate publication. */
export interface PublishOptions {
  target?: string;
  registry: string;
  plainHttp?: boolean;
}

const isCI = process.env['CI'] === 'true';

export class ImagePublisher {
  constructor(
    private dockerService = new DockerService(),
    private signingService = new SigningService()
  ) {}

  async publishSingleImage(targetName: string, targetDir: string, options: PublishOptions): Promise<void> {
    await withImageLock(targetDir, async () => {
      const receipt = readImageReceipt(targetDir, targetName);
      const configFile = structureConfigPath(targetDir);
      const structureTest = requireStructureTest(receipt, configFile);
      await this.dockerService.requireImage(receipt.imageId);
      const registry = new ImageRegistry(options.registry, options.plainHttp);
      const repository = `${options.registry}/${targetName}`;
      const candidate = `${repository}:sha256-${receipt.imageId.slice(7)}`;
      let digest = await registry.digest(candidate, true);
      let remoteTargetDigest: string;
      if (digest) {
        remoteTargetDigest = `${repository}@${digest}`;
        const configDigest = await registry.imageConfigDigest(remoteTargetDigest);
        if (configDigest !== receipt.imageId && receipt.publications[options.registry] !== remoteTargetDigest) {
          throw new Error(`Existing candidate ${candidate} does not match the tested image or a recorded publication.`);
        }
        console.log(`Candidate already exists: ${remoteTargetDigest}`);
      } else {
        console.log(`\n🏷️  Preparing distribution layers for [${chalk.yellow(targetName)}]...`);
        const createdAlias = await this.dockerService.prepareAlias(receipt.imageId, candidate);
        try {
          remoteTargetDigest = await this.dockerService.pushImage(candidate);
        } finally {
          if (createdAlias) await this.dockerService.removeAlias(candidate);
        }
        digest = remoteTargetDigest.slice(repository.length + 1);
        if (!/^sha256:[a-f0-9]{64}$/.test(digest) || await registry.digest(candidate) !== digest) {
          throw new Error(`Registry candidate ${candidate} did not resolve to the pushed digest.`);
        }
      }

      const remoteConfigDigest = await registry.imageConfigDigest(remoteTargetDigest);
      receipt.publications[options.registry] = remoteTargetDigest;
      if (receipt.publicationTests) delete receipt.publicationTests[options.registry];
      writeImageReceipt(targetDir, receipt);
      if (remoteConfigDigest !== receipt.imageId) {
        console.log(`Registry converted the image configuration; testing published digest ${remoteTargetDigest}.`);
        const existed = await this.dockerService.pullDigest(remoteTargetDigest);
        try {
          await testImageStructure(targetName, configFile, remoteTargetDigest);
        } finally {
          if (!existed) await this.dockerService.removeAlias(remoteTargetDigest);
        }
        if (structureConfigDigest(configFile) !== structureTest.configDigest) {
          throw new Error(`Structure test configuration changed during the published-image test for ${targetName}.`);
        }
      }

      const repoRoot = findRepoRoot(process.cwd());
      const keyPath = path.resolve(repoRoot, 'cosign.key');
      const cosignPass = process.env['COSIGN_PASSWORD'];

      if (!hasBinary('cosign')) {
        console.log(chalk.gray(`\nℹ️  Skipping image signing: cosign binary not found on host PATH.`));
      } else if (isCI) {
        console.log(chalk.cyan(`\n🔏 Cryptographically signing image via Cosign keyless OIDC identity...`));
        await this.signingService.signDigest(remoteTargetDigest, { isCI: true, keyPath });
        console.log(chalk.green(`🔑 Cryptographic signature verified and attached to registry context!`));
      } else {
        const hasKey = fs.existsSync(keyPath) || Boolean(process.env['COSIGN_PRIVATE_KEY']);
        if (!hasKey || !cosignPass) {
          const reason = !hasKey ? `no cosign private key found at '${keyPath}' or via COSIGN_PRIVATE_KEY` : 'COSIGN_PASSWORD missing';
          console.log(chalk.gray(`\nℹ️  Skipping image signing: ${reason}.`));
        } else {
          await this.signingService.signDigest(remoteTargetDigest, {
            isCI: false, keyPath, cosignPass, allowHttpRegistry: true,
          });
        }
      }
      receipt.publicationTests ??= {};
      receipt.publicationTests[options.registry] = {
        reference: remoteTargetDigest,
        configDigest: structureTest.configDigest,
      };
      writeImageReceipt(targetDir, receipt);
      console.log(chalk.green(`\n✅ Published candidate: ${remoteTargetDigest}`));
    });
  }
}

export async function runImagesPublish(options: PublishOptions): Promise<void> {
  const repoRoot = findRepoRoot();
  const validTargets = discoverContainerTargets(repoRoot);
  const publisher = new ImagePublisher();

  if (options.target) {
    const parsedTarget = normalizeTargetName(options.target);

    const targetDir = validTargets.get(parsedTarget);
    if (!targetDir) {
      console.error(chalk.red(`\n❌ Error: Invalid container publish target '${options.target}'.`));
      throw new Error(`Target tracking mapping failure for ${options.target}`);
    }
    await publisher.publishSingleImage(parsedTarget, targetDir, options);
  } else {
    for (const [targetName, targetDir] of validTargets) {
      await publisher.publishSingleImage(targetName, targetDir, options);
    }
  }
}
