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

// Hoisted mock requirement matching your test utility rules
vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}));

import { spawnSync } from 'node:child_process';
import { setupOrchestratorTestContext } from '../../../../utils/test-utils';
import { runImagesLint } from '../lint';

describe('runImagesLint Engine & Router', () => {
  let repoRoot: string;
  const testContext = setupOrchestratorTestContext();

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'crew-docker-lint-'));
    writeFileSync(join(repoRoot, 'backstage.json'), '{}', 'utf8');
    vi.spyOn(process, 'cwd').mockReturnValue(repoRoot);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (repoRoot) rmSync(repoRoot, { recursive: true, force: true });
  });

  it('runs local hadolint optimization if the binary is discovered on host system', async () => {
    const servicePath = join(repoRoot, 'packages/identity-service');
    mkdirSync(servicePath, { recursive: true });
    writeFileSync(join(servicePath, 'Dockerfile'), 'FROM node:alpine', 'utf8');

    // First call for `which hadolint` / `where hadolint` returning success (0)
    // Second call for the actual execution output run returning success (0)
    testContext.mockSequenceStatuses(0, 0);

    await runImagesLint({ target: 'identity-service' });

    expect(spawnSync).toHaveBeenCalledWith('hadolint', [join(servicePath, 'Dockerfile')], expect.any(Object));
  });

  it('falls back seamlessly to docker streaming execution buffer if hadolint is missing from path', async () => {
    const servicePath = join(repoRoot, 'packages/payment-service');
    mkdirSync(servicePath, { recursive: true });
    writeFileSync(join(servicePath, 'Dockerfile'), 'FROM node:alpine', 'utf8');

    // First call for host binary lookup returns failure (1), second call for fallback docker execution passes (0)
    testContext.mockSequenceStatuses(1, 0);

    await runImagesLint({ target: 'payment-service' });

    expect(spawnSync).toHaveBeenCalledWith(
      'docker',
      ['run', '--rm', '-i', 'hadolint/hadolint'],
      expect.objectContaining({
        input: expect.any(Buffer),
        stdio: ['pipe', 'inherit', 'inherit']
      })
    );
  });

  it('aborts processing sequence immediately if validation rules are violated', async () => {
    const servicePath = join(repoRoot, 'packages/broken-service');
    mkdirSync(servicePath, { recursive: true });
    writeFileSync(join(servicePath, 'Dockerfile'), 'FROM node:alpine\nRUN apt-get update', 'utf8');

    // host check passes (0), but linter output returns violation rule code (1)
    testContext.mockSequenceStatuses(0, 1);

    await expect(runImagesLint({ target: 'broken-service' })).rejects.toThrow(
      'Lint verification failed on target broken-service'
    );
  });
});
