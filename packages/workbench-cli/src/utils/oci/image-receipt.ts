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
import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import lockfile from 'proper-lockfile';

/** Evidence and registry references for one locally built image. */
export interface ImageReceipt {
  version: 1;
  target: string;
  imageId: string;
  localTag: string;
  platform: string;
  turboHash?: string;
  structureTest?: { imageId: string; configDigest: string };
  publications: Record<string, string>;
  publicationTests?: Record<string, { reference: string; configDigest: string }>;
}

/** Returns the workspace-local receipt location. */
export function imageReceiptPath(targetDir: string): string {
  return join(targetDir, '.turbo', 'image-receipt.json');
}

/** Serializes operations that read or update a target's receipt. */
export async function withImageLock<T>(targetDir: string, operation: () => Promise<T>): Promise<T> {
  const dir = join(targetDir, '.turbo');
  mkdirSync(dir, { recursive: true });
  const release = await lockfile.lock(dir, {
    lockfilePath: join(dir, 'image-receipt.lock'),
    stale: 120000,
    update: 10000,
    retries: { retries: 300, minTimeout: 500, maxTimeout: 500, factor: 1 },
  });
  try {
    return await operation();
  } finally {
    await release();
  }
}

/** Reads and validates the build receipt, failing closed when it is absent or invalid. */
export function readImageReceipt(targetDir: string, target: string): ImageReceipt {
  const file = imageReceiptPath(targetDir);
  let value: ImageReceipt;
  try {
    value = JSON.parse(readFileSync(file, 'utf8')) as ImageReceipt;
  } catch (error) {
    throw new Error(`Cannot read image receipt ${file}; build the image first.`, { cause: error });
  }
  if (!value || value.version !== 1 || value.target !== target
    || !/^sha256:[a-f0-9]{64}$/.test(value.imageId)
    || value.localTag !== `local/${target}:sha256-${value.imageId.slice(7)}`
    || typeof value.platform !== 'string' || !value.platform
    || !value.publications || typeof value.publications !== 'object' || Array.isArray(value.publications)) {
    throw new Error(`Invalid image receipt ${file}.`);
  }
  return value;
}

/** Atomically persists a receipt after the operation it describes has succeeded. */
export function writeImageReceipt(targetDir: string, receipt: ImageReceipt): void {
  const dir = join(targetDir, '.turbo');
  mkdirSync(dir, { recursive: true });
  const file = imageReceiptPath(targetDir);
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
    renameSync(temporary, file);
  } finally {
    rmSync(temporary, { force: true });
  }
}

/** Computes the digest of a structure-test configuration. */
export function structureConfigDigest(configPath: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(configPath)).digest('hex')}`;
}

/** Locates the one required structure-test configuration for a target. */
export function structureConfigPath(targetDir: string): string {
  const dir = join(targetDir, '__tests__');
  const files = readdirSync(dir).filter(file => file.endsWith('.cst.yaml'));
  if (files.length !== 1) {
    throw new Error(`Expected exactly one structure test configuration in ${dir}; found ${files.length}.`);
  }
  return join(dir, files[0]!);
}

/** Requires evidence for the current image and current structure-test configuration. */
export function requireStructureTest(receipt: ImageReceipt, configPath: string): NonNullable<ImageReceipt['structureTest']> {
  if (receipt.structureTest?.imageId !== receipt.imageId
    || receipt.structureTest.configDigest !== structureConfigDigest(configPath)) {
    throw new Error(`The image ${receipt.imageId} has no passing structure test for the current configuration.`);
  }
  return receipt.structureTest;
}
