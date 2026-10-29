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
import { SigningService, resolveTargetTags } from '../../../utils/oci';

export interface ComposePublishOptions {
  registry: string;
  imageTag: string;
  plainHttp?: boolean;
}

const isCI = process.env['CI'] === 'true';

export class ComposeArtifactPublisher {
  constructor(private signingService = new SigningService()) {}

  async publishArtifact(options: ComposePublishOptions): Promise<void> {
    const { registry, imageTag, plainHttp } = options;
    const repoRoot = findRepoRoot(process.cwd());

    // Resolve location of target workspace configuration
    const composeDir = path.resolve(repoRoot, 'packages/deploy/compose');
    const composeFile = path.resolve(composeDir, 'src/compose.yml');

    if (!fs.existsSync(composeFile)) {
      throw new Error(`Compose configuration target not found at path: ${composeFile}`);
    }

    const { remoteTargetTag } = resolveTargetTags('compose', registry, imageTag);
    const registryHost = registry.split('/')[0] ?? '';
    const isLoopback = registryHost === 'localhost' || registryHost.startsWith('localhost:')
      || registryHost === '127.0.0.1' || registryHost.startsWith('127.0.0.1:');

    // Determine if we need to fall back to plain HTTP / insecure registries
    const useInsecure = plainHttp || isLoopback;

    console.log(`\n📦 Packaging compose manifest for [${chalk.yellow(remoteTargetTag)}]...`);

    if (!hasBinary('oras')) {
      throw new Error('ORAS CLI is required on PATH to publish Compose OCI artifacts.');
    }

    console.log(chalk.blue(`🚀 Publishing the uninterpolated Compose file with ORAS...`));

    // FIX: The working directory context is the parent folder of `compose.yml`.
    // The target file inside `path.dirname(composeFile)` is exactly 'compose.yml'.
    const pushResult = spawnSync('oras', [
      'push',
      ...(useInsecure ? ['--plain-http'] : []),
      '--artifact-type', 'application/vnd.docker.compose.project',
      '--format', 'json',
      remoteTargetTag,
      'compose.yml:application/vnd.docker.compose.file+yaml',
    ], { cwd: path.dirname(composeFile), stdio: 'pipe', encoding: 'utf-8' });

    if (pushResult.status !== 0) {
      throw new Error(`Compose artifact push failed: ${pushResult.error?.message || pushResult.stderr || `exit status ${pushResult.status}`}`);
    }

    let result: { digest?: unknown };
    try {
      result = JSON.parse(pushResult.stdout);
    } catch (error) {
      throw new Error('ORAS returned invalid JSON after publishing the Compose artifact.', { cause: error });
    }
    if (!result || typeof result.digest !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(result.digest)) {
      throw new Error('ORAS did not return a valid manifest digest for the published Compose artifact.');
    }

    const baseTargetRepo = remoteTargetTag.slice(0, remoteTargetTag.lastIndexOf(':'));
    const remoteTargetDigest = `${baseTargetRepo}@${result.digest}`;
    console.log(chalk.green(`\n✅ Successfully published compose artifact: ${remoteTargetDigest}`));

    // --- CRYPTOGRAPHIC SIGNING FLOW ---
    const keyPath = path.resolve(repoRoot, 'cosign.key');
    const cosignPass = process.env['COSIGN_PASSWORD'];

    if (!hasBinary('cosign')) {
      console.log(chalk.gray(`\nℹ️  Skipping artifact signing: cosign binary not found on host PATH.`));
      return;
    }

    // Common operational configurations for the signing service
    const signingOpts = {
      keyPath,
      allowInsecureRegistry: useInsecure // Ensure local non-HTTPS registries don't reject signatures
    };

    if (isCI) {
      console.log(chalk.cyan(`\n🔏 Cryptographically signing artifact via Cosign keyless OIDC identity...`));
      await this.signingService.signDigest(remoteTargetDigest, { ...signingOpts, isCI: true });
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
    await this.signingService.signDigest(remoteTargetDigest, { ...signingOpts, isCI: false, cosignPass });
    console.log(chalk.green(`🔑 Cryptographic signature verified and attached to registry context!`));
  }
}

export async function runComposePublish(options: ComposePublishOptions): Promise<void> {
  const publisher = new ComposeArtifactPublisher();
  await publisher.publishArtifact(options);
}
