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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}));

import { spawnSync } from 'node:child_process';
import { runImagesLint } from '../lint.js';

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

describe('runImagesLint Engine & Router', () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'crew-docker-lint-'));
    // Fix: Placing backstage.json at the exact folder level root ensures workspace discovery runs cleanly
    writeFileSync(join(repoRoot, 'backstage.json'), '{}', 'utf8');
    vi.spyOn(process, 'cwd').mockReturnValue(repoRoot);
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (repoRoot) rmSync(repoRoot, { recursive: true, force: true });
  });

  it('runs local hadolint optimization if the binary is discovered on host system', async () => {
    const servicePath = join(repoRoot, 'packages/identity-service');
    mkdirSync(servicePath, { recursive: true });
    writeFileSync(join(servicePath, 'Dockerfile'), 'FROM node:alpine', 'utf8');
    writeJson(join(servicePath, 'package.json'), { name: '@ai-crew-suite/identity-service' });

    vi.mocked(spawnSync)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' } as any);

    await runImagesLint({ target: 'identity-service' });

    expect(spawnSync).toHaveBeenLastCalledWith(
      'hadolint',
      [join(servicePath, 'Dockerfile')],
      expect.objectContaining({ stdio: ['pipe', 'pipe', 'pipe'] })
    );
  });

  it('falls back seamlessly to docker streaming execution buffer if hadolint is missing from path', async () => {
    const servicePath = join(repoRoot, 'packages/payment-service');
    mkdirSync(servicePath, { recursive: true });
    writeFileSync(join(servicePath, 'Dockerfile'), 'FROM node:alpine', 'utf8');
    writeJson(join(servicePath, 'package.json'), { name: '@ai-crew-suite/payment-service' });

    vi.mocked(spawnSync)
      .mockReturnValueOnce({ status: 1 } as any)
      .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' } as any);

    await runImagesLint({ target: 'payment-service' });

    expect(spawnSync).toHaveBeenLastCalledWith(
      'docker',
      ['run', '--rm', '-i', 'hadolint/hadolint'],
      expect.objectContaining({
        input: expect.any(Buffer),
        stdio: ['pipe', 'pipe', 'pipe']
      })
    );
  });

  it('aborts processing sequence immediately if validation rules are violated', async () => {
    const servicePath = join(repoRoot, 'packages/broken-service');
    mkdirSync(servicePath, { recursive: true });
    writeFileSync(join(servicePath, 'Dockerfile'), 'FROM node:alpine\nRUN apt-get update', 'utf8');
    writeJson(join(servicePath, 'package.json'), { name: '@ai-crew-suite/broken-service' });

    vi.mocked(spawnSync)
      .mockReturnValueOnce({ status: 0 } as any)
      .mockReturnValueOnce({
        status: 1,
        stdout: 'Dockerfile:2 DL3009 error: Info message',
        stderr: ''
      } as any);

    await expect(runImagesLint({ target: 'broken-service' })).rejects.toThrow(
      'Lint verification failed on target broken-service'
    );
  });
});
