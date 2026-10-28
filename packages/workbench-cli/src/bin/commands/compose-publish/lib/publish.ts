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
import { spawnSync } from 'node:child_process';
import chalk from 'chalk';
import { findRepoRoot, hasBinary } from '../../../utils/workspace';
import { SigningService, normalizeTargetName } from '../../../utils/oci';

export interface ComposePublishOptions {
  registry: string;
  imageTag: string;
}

const isCI = process.env['CI'] === 'true';

export class ComposeArtifactPublisher {
  constructor(private signingService = new SigningService()) {}

  async publishArtifact(options: ComposePublishOptions): Promise<void> {
    const { registry, imageTag } = options;
    const repoRoot = findRepoRoot(process.cwd());

    // Resolve location of target workspace configuration
    const composeDir = path.resolve(repoRoot, 'packages/deploy/compose');
    const composeFile = path.resolve(composeDir, 'src/compose.yml');

    if (!fs.existsSync(composeFile)) {
      throw new Error(`Compose configuration target not found at path: ${composeFile}`);
    }

    const targetName = normalizeTargetName('compose');
    const isLocalZot = registry.startsWith('localhost') || registry.startsWith('127.0.0.1') || registry.includes('zot');
    const remoteTargetTag = isLocalZot
      ? `${registry}/${targetName}:${imageTag}`
      : `${registry}/workbench-${targetName}:${imageTag}`;

    console.log(`\n📦 Packaging compose manifest for [${chalk.yellow(remoteTargetTag)}]...`);

    if (!hasBinary('docker')) {
      throw new Error('Docker runtime operational binary required on system host PATH to push OCI artifacts.');
    }

    // Push the raw compose file as an OCI artifact using the native Docker buildx asset backend
    console.log(chalk.blue(`🚀 Initializing push command via system shell integration...`));

    // NOTE: Docker enables artifact composition using standard content type overrides.
    // Adjust command parameters to match target registry specifications if custom media types are forced.
    const pushResult = spawnSync('docker', [
      'buildx', 'imagetools', 'create',
      '--tag', remoteTargetTag,
      composeFile
    ], { stdio: 'pipe', encoding: 'utf-8' });

    if (pushResult.status !== 0) {
      throw new Error(`Docker artifact registration failed: ${pushResult.stderr}`);
    }

    // Resolve structural Digest signatures from local status streams or inspect protocols
    const inspectResult = spawnSync('docker', ['buildx', 'imagetools', 'inspect', remoteTargetTag], {
      stdio: 'pipe',
      encoding: 'utf-8'
    });

    const digestMatch = inspectResult.stdout.match(/(sha256:[a-f0-9]+)/);
    if (!digestMatch) {
      throw new Error('Failed to isolate a remote signature digest mapping for the published OCI context.');
    }

    const baseTargetRepo = remoteTargetTag.split(':')[0];
    const remoteTargetDigest = `${baseTargetRepo}@${digestMatch[1]}`;
    console.log(chalk.green(`\n✅ Successfully published compose artifact: ${remoteTargetDigest}`));

    // --- CRYPTOGRAPHIC SIGNING FLOW ---
    const keyPath = path.resolve(repoRoot, 'cosign.key');
    const cosignPass = process.env['COSIGN_PASSWORD'];

    if (!hasBinary('cosign')) {
      console.log(chalk.gray(`\nℹ️  Skipping artifact signing: cosign binary not found on host PATH.`));
      return;
    }

    if (isCI) {
      console.log(chalk.cyan(`\n🔏 Cryptographically signing artifact via Cosign keyless OIDC identity...`));
      await this.signingService.signDigest(remoteTargetDigest, { isCI: true, keyPath });
      console.log(chalk.green(`🔑 Cryptographic signature verified and attached to registry context!`));
      return;
    }

    const hasKey = fs.existsSync(keyPath) || Boolean(process.env['COSIGN_PRIVATE_KEY']);

    if (!hasKey || !cosignPass) {
      const reason = !hasKey
        ? `no cosign private key found at '${keyPath}' or via COSIGN_PRIVATE_KEY env parameter`
        : 'COSIGN_PASSWORD env parameter missing';
      console.log(chalk.gray(`\nℹ️  Skipping artifact signing: ${reason}.`));
      return;
    }

    console.log(chalk.cyan(`\n🔏 Cryptographically signing artifact via Cosign static keypair...`));
    await this.signingService.signDigest(remoteTargetDigest, { isCI: false, keyPath, cosignPass });
    console.log(chalk.green(`🔑 Cryptographic signature verified and attached to registry context!`));
  }
}

export async function runComposePublish(options: ComposePublishOptions): Promise<void> {
  const publisher = new ComposeArtifactPublisher();
  await publisher.publishArtifact(options);
}
