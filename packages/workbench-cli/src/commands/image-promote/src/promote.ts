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
import { discoverContainerTargets, findRepoRoot } from '../../../utils/workspace';
import { normalizeTargetName } from '../../../utils/oci';
import { ImageRegistry } from '../../../utils/oci/image-registry';
import { readImageReceipt, requireStructureTest, structureConfigPath, withImageLock } from '../../../utils/oci/image-receipt';

/** Selects the published candidate and mutable channel to promote. */
export interface PromoteOptions {
  target: string;
  registry: string;
  tag: string;
  plainHttp?: boolean;
}

/** Promotes a tested, already-published candidate by its registry digest. */
export async function runImagePromote(options: PromoteOptions): Promise<void> {
  const target = normalizeTargetName(options.target);
  const targetDir = discoverContainerTargets(findRepoRoot()).get(target);
  if (!targetDir) throw new Error(`Unknown container target ${options.target}.`);
  if (/^sha256-/i.test(options.tag)) throw new Error('Content-derived candidate tags cannot be used as promotion channels.');
  await withImageLock(targetDir, async () => {
    const receipt = readImageReceipt(targetDir, target);
    requireStructureTest(receipt, structureConfigPath(targetDir));
    const reference = receipt.publications[options.registry];
    const repository = `${options.registry}/${target}`;
    if (typeof reference !== 'string' || !reference.startsWith(`${repository}@sha256:`)
      || !/^sha256:[a-f0-9]{64}$/.test(reference.slice(repository.length + 1))) {
      throw new Error(`No valid publication for ${target} in ${options.registry}; publish it first.`);
    }
    const test = receipt.publicationTests?.[options.registry];
    if (test?.reference !== reference || test.configDigest !== receipt.structureTest?.configDigest) {
      throw new Error(`Published image ${reference} has not passed the current structure test.`);
    }
    const digest = reference.slice(repository.length + 1);
    const registry = new ImageRegistry(options.registry, options.plainHttp);
    if (await registry.digest(reference) !== digest) throw new Error(`Registry did not return the expected digest for ${reference}.`);
    await registry.promote(reference, options.tag);
    const channel = `${repository}:${options.tag}`;
    if (await registry.digest(channel) !== digest) throw new Error(`Promotion verification failed for ${channel}.`);
    console.log(`Promoted ${reference} to ${channel}.`);
  });
}
