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
import fs from 'node:fs';

export interface SignerOptions {
  isCI: boolean;
  keyPath: string;
  cosignPass?: string;
}

export class SigningService {
  /**
   * Cryptographically signs a specific OCI manifest digest reference and publishes
   * the resulting signature artifact to the target registry via the native Cosign
   * client.
   */
  async signDigest(imageDigest: string, options: SignerOptions): Promise<void> {
    const { isCI, keyPath, cosignPass } = options;
    const cosignArgs = ['sign', '--yes', imageDigest];
    let spawnEnv: NodeJS.ProcessEnv | undefined;

    if (isCI) {
      // Keyless profile: Cosign exchanges ambient identity tokens for short-lived certificates
    } else {
      const keyRef = fs.existsSync(keyPath)
        ? keyPath
        : process.env['COSIGN_PRIVATE_KEY']
          ? 'env://COSIGN_PRIVATE_KEY'
          : undefined;

      if (!keyRef) {
        throw new Error(`No cosign private key found at '${keyPath}' or via COSIGN_PRIVATE_KEY env parameter`);
      }

      if (!cosignPass) {
        throw new Error('COSIGN_PASSWORD env parameter missing');
      }

      cosignArgs.push(
        '--key', keyRef,
        '--allow-http-registry=true',
        '--use-signing-config=false',
        '--tlog-upload=false',
      );

      spawnEnv = { ...process.env, COSIGN_PASSWORD: cosignPass };
    }

    const result = spawnSync('cosign', cosignArgs, { stdio: 'inherit', env: spawnEnv });

    if (result.status !== 0) {
      throw new Error(`Cosign signature pipeline exited with failure status code ${result.status}`);
    }
  }
}
