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
import { execFile } from 'node:child_process';

const digestPattern = /^sha256:[a-f0-9]{64}$/;

type OrasResult = { error: Error | null; stdout: string; stderr: string };

function executeOras(args: string[]): Promise<OrasResult> {
  return new Promise(resolve => {
    execFile('oras', args, { encoding: 'utf8', timeout: 30000 }, (error, stdout, stderr) => {
      resolve({ error, stdout, stderr });
    });
  });
}

/** Provides digest-preserving operations against an OCI registry using ORAS. */
export class ImageRegistry {
  constructor(
    private readonly registry: string,
    private readonly plainHttp = false,
    private readonly execute = executeOras,
  ) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9.:-]*(?:\/[a-zA-Z0-9._-]+)+$/.test(registry)) {
      throw new Error('Registry must be a host and namespace without a URL scheme.');
    }
  }

  private async invoke(args: string[], allowMissing = false): Promise<string | undefined> {
    const host = this.registry.split('/')[0]!;
    const insecure = this.plainHttp || host === 'localhost' || host.startsWith('localhost:')
      || host === '127.0.0.1' || host.startsWith('127.0.0.1:');
    const result = await this.execute([...args, ...(insecure ? ['--plain-http'] : [])]);
    if (result.error) {
      const detail = result.stderr.trim() || result.error.message;
      if (allowMissing && /MANIFEST_UNKNOWN|404 Not Found|404 Not found|: not found$/.test(detail)) return undefined;
      throw new Error(`ORAS failed: ${detail}`, { cause: result.error });
    }
    return result.stdout;
  }

  /** Resolves a tag or digest to the registry's manifest digest. */
  async digest(reference: string, allowMissing = false): Promise<string | undefined> {
    const output = await this.invoke(['manifest', 'fetch', '--descriptor', reference], allowMissing);
    if (output === undefined) return undefined;
    const descriptor: { digest?: unknown } = JSON.parse(output);
    if (typeof descriptor.digest !== 'string' || !digestPattern.test(descriptor.digest)) {
      throw new Error(`Invalid registry manifest descriptor for ${reference}.`);
    }
    return descriptor.digest;
  }

  /** Returns the image configuration digest from a single-platform manifest. */
  async imageConfigDigest(reference: string): Promise<string> {
    const output = await this.invoke(['manifest', 'fetch', reference]);
    if (output === undefined) throw new Error(`Registry image not found: ${reference}`);
    const manifest: { config?: { digest?: unknown } } = JSON.parse(output);
    if (typeof manifest.config?.digest !== 'string' || !digestPattern.test(manifest.config.digest)) {
      throw new Error(`Registry manifest ${reference} does not contain a valid image config digest.`);
    }
    return manifest.config.digest;
  }

  /** Points a channel at a published manifest without changing that manifest. */
  async promote(reference: string, tag: string): Promise<void> {
    if (!/^[\w][\w.-]{0,127}$/.test(tag)) throw new Error('Invalid image promotion tag.');
    await this.invoke(['tag', reference, tag]);
  }
}
