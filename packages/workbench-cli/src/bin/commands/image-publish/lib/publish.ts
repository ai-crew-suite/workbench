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
import { execSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import chalk from 'chalk';
import { findRepoRoot, discoverContainerTargets, hasBinary } from '../../../utils/workspace.js';

export interface PublishOptions {
  target?: string;
  registry: string;
  imageTag: string;
}

const isCI = process.env['CI'] === 'true';

function publishSingleImage(targetName: string, options: PublishOptions): void {
  const { registry, imageTag } = options;
  const localSourceTag = `local/${targetName}:${imageTag}`;

  const isLocalZot = registry.startsWith('localhost') || registry.startsWith('127.0.0.1') || registry.includes('zot');

  const remoteTargetTag = isLocalZot
    ? `${registry}/${targetName}:${imageTag}`
    : `${registry}/workbench-${targetName}:${imageTag}`;

  console.log(`\n🏷️  Preparing distribution layers for [${chalk.yellow(targetName)}]...`);

  // Apply remote tracking tag configuration
  const tagResult = spawnSync('docker', ['tag', localSourceTag, remoteTargetTag], { stdio: 'inherit' });

  if (tagResult.status !== 0) {
    throw new Error(`Failed to tag target container image for ${targetName}`);
  }

  // Push compiled layer blobs to the destination registry
  console.log(chalk.blue(`🚀 Streaming image packages to distribution registry...`));

  const pushResult = spawnSync('docker', ['push', remoteTargetTag], { stdio: 'inherit' });

  if (pushResult.status !== 0) {
    throw new Error(
      `Failed to push target container image layers to remote destination registry: ${remoteTargetTag}`
    );
  }

  console.log(chalk.green(`\n✅ Successfully published image package: ${remoteTargetTag}`));

  // Fetch the definitive digest hash of the pushed image directly from local Docker tracking context
  let remoteTargetDigest = remoteTargetTag;
  try {
    // Query Docker for the exact remote distribution digest for this pushed reference
    const distributionDigest = execSync(
      `docker inspect --format='{{range .RepoDigests}}{{if contains . "${registry}"}}{{.}}{{end}}{{end}}' ${remoteTargetTag}`
    )
      .toString()
      .trim();

    if (distributionDigest) {
      remoteTargetDigest = distributionDigest;
    } else {
      // Direct extraction fallback from the JSON array string
      const digestsRaw = execSync(`docker inspect --format='{{json .RepoDigests}}' ${remoteTargetTag}`)
        .toString()
        .trim();
      const digests: string[] = JSON.parse(digestsRaw);

      // Look for any string containing your registry address
      const matched = digests.find(d => d.includes(registry));
      if (matched) {
        remoteTargetDigest = matched;
      }
    }
  } catch {
    console.log(chalk.gray(`   Could not resolve image digest via Docker inspect; falling back to tag reference.`));
  }

  // Cryptographically sign the image layers via Cosign
  if (hasBinary('cosign')) {
    const repoRoot = findRepoRoot(process.cwd());
    const keyPath = path.resolve(repoRoot, 'cosign.key');
    const hasLocalKey = fs.existsSync(keyPath);
    const cosignPass = process.env['COSIGN_PASSWORD'];

    // Durable Strategy Selector: trigger if running keyless in CI OR if local workstation keys exist
    if (isCI || (hasLocalKey && cosignPass)) {
      console.log(chalk.cyan(`\n🔏 Cryptographically signing image via Cosign...`));

      const cosignArgs = ['sign'];
      let configPath = '';

      if (isCI) {
        // Keyless Configuration Profile: GitHub OIDC token provides the identity context natively
        console.log(chalk.gray('   Identity strategy: Keyless OIDC Token Exchange'));
        cosignArgs.push(
          '--allow-http-registry=true',
          // Explicitly map the container target context to circumvent Zot manifest lookup rewrites
          '--sign-container-identity', remoteTargetTag
        );
      } else {
        // Local Key-Based Profile
        console.log(chalk.gray('   Identity strategy: Local Static Keypair'));

        // Generate an on-the-fly offline signing config that omits Rekor URLs
        const signingConfig = {
          mediaType: "application/vnd.dev.sigstore.signingconfig.v0.2+json",
          caUrls: [
            {
              url: "https://sigstore.dev",
              majorApiVersion: 1,
              validFor: { start: "2022-04-13T20:06:15.000Z" },
              operator: "sigstore.dev"
            }
          ],
          oidcUrls: [
            {
              url: "https://sigstore.dev",
              majorApiVersion: 1,
              validFor: { start: "2022-04-13T20:06:15.000Z" },
              operator: "sigstore.dev"
            }
          ]
        };

        configPath = path.resolve(repoRoot, 'cosign-offline-config.json');
        fs.writeFileSync(configPath, JSON.stringify(signingConfig, null, 2));

        cosignArgs.push(
          '--key', keyPath,
          '--allow-http-registry=true',
          '--signing-config', configPath,
          // Explicitly map the container target context to circumvent Zot manifest lookup rewrites
          '--sign-container-identity', remoteTargetTag,
          '-a', `signature.sigstore.dev/subject=AI Crew Suite Core Platform Team`
        );
      }

      // Pass --yes and the precise immutable digest
      cosignArgs.push('--yes', remoteTargetDigest);

      const signResult = spawnSync('cosign', cosignArgs, {
        stdio: 'inherit',
        env: { ...process.env, COSIGN_PASSWORD: cosignPass }
      });

      // Clean up the temporary configuration file if it was created
      if (configPath && fs.existsSync(configPath)) {
        try {
          fs.unlinkSync(configPath);
        } catch {
          // Fail-safe cleanup suppression
        }
      }

      if (signResult.status === 0) {
        console.log(chalk.green(`🔑 Cryptographic signature verified and attached to Zot container context!`));
      } else {
        console.warn(chalk.yellow(`⚠️  Cosign error: Signature step exited with status code ${signResult.status}`));
      }
    } else {
      const reason = !hasLocalKey
        ? `no local 'cosign.key' found at '${keyPath}' (and not executing inside a CI runner)`
        : 'COSIGN_PASSWORD environment or file variable missing';
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
