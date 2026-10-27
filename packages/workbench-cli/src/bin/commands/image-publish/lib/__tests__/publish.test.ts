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
import { runImagesPublish } from '../publish';

describe('runImagesPublish Engine & Router', () => {
  let repoRoot: string;
  const testContext = setupOrchestratorTestContext();

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'crew-publish-test-'));
    writeFileSync(join(repoRoot, 'backstage.json'), '{}', 'utf8');
    vi.spyOn(process, 'cwd').mockReturnValue(repoRoot);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (repoRoot) rmSync(repoRoot, { recursive: true, force: true });
  });

  it('correctly maps straight tags for local zot environments without introducing prefix strings', async () => {
    const servicePath = join(repoRoot, 'packages/cache-service');
    mkdirSync(servicePath, { recursive: true });
    writeFileSync(join(servicePath, 'Dockerfile'), 'FROM scratch', 'utf8');

    testContext.mockAllSuccessful();

    await runImagesPublish({
      target: 'cache-service',
      registry: 'localhost:32443/ai-crew-suite',
      imageTag: 'latest'
    });

    expect(spawnSync).toHaveBeenCalledWith(
      'docker',
      ['tag', 'local/cache-service:latest', 'localhost:32443/ai-crew-suite/cache-service:latest'],
      expect.any(Object)
    );
    expect(spawnSync).toHaveBeenCalledWith(
      'docker',
      ['push', 'localhost:32443/ai-crew-suite/cache-service:latest'],
      expect.any(Object)
    );
  });

  it('injects the workbench- subtag prefix when routing images to a GHCR cloud registry target', async () => {
    const servicePath = join(repoRoot, 'packages/api-service');
    mkdirSync(servicePath, { recursive: true });
    writeFileSync(join(servicePath, 'Dockerfile'), 'FROM scratch', 'utf8');

    testContext.mockAllSuccessful();

    await runImagesPublish({
      target: 'api-service',
      registry: 'ghcr.io/ai-crew-suite',
      imageTag: 'v2.1'
    });

    expect(spawnSync).toHaveBeenCalledWith(
      'docker',
      ['tag', 'local/api-service:v2.1', 'ghcr.io/ai-crew-suite/workbench-api-service:v2.1'],
      expect.any(Object)
    );
    expect(spawnSync).toHaveBeenCalledWith(
      'docker',
      ['push', 'ghcr.io/ai-crew-suite/workbench-api-service:v2.1'],
      expect.any(Object)
    );
  });

  it('fails early and transparently throws an exception if the underlying push step returns an issue status code', async () => {
    const servicePath = join(repoRoot, 'packages/network-service');
    mkdirSync(servicePath, { recursive: true });
    writeFileSync(join(servicePath, 'Dockerfile'), 'FROM scratch', 'utf8');

    // tag returns success status (0) but push returns connection closed code status failure (1)
    testContext.mockSequenceStatuses(0, 1);

    await expect(runImagesPublish({
      target: 'network-service',
      registry: 'localhost:32443',
      imageTag: 'latest'
    })).rejects.toThrow('Failed to push target container image layers to remote destination registry');
  });
});
