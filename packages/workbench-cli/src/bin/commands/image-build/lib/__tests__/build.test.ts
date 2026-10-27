/*
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
import { setupOrchestratorTestContext } from '../../../../utils/test-utils';
import { discoverContainerTargets } from '../../../../utils/workspace';
import { runImagesBuild } from '../build';

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

describe('discoverContainerTargets', () => {
  let repoRoot: string;

  afterEach(() => {
    if (repoRoot) rmSync(repoRoot, { recursive: true, force: true });
  });

  it('scans and isolates directories that contain a Dockerfile', () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'crew-docker-discover-'));

    const containerAPath = join(repoRoot, 'packages/auth-service');
    mkdirSync(containerAPath, { recursive: true });
    writeFileSync(join(containerAPath, 'Dockerfile'), 'FROM node:alpine', 'utf8');

    const containerBPath = join(repoRoot, 'packages/deploy/containers/payment-gateway');
    mkdirSync(containerBPath, { recursive: true });
    writeFileSync(join(containerBPath, 'Dockerfile'), 'FROM node:alpine', 'utf8');

    const scriptsPath = join(repoRoot, 'packages/deploy/containers/scripts');
    mkdirSync(scriptsPath, { recursive: true });
    writeFileSync(join(scriptsPath, 'Dockerfile'), 'FROM alpine', 'utf8');

    const targets = discoverContainerTargets(repoRoot);

    expect(targets.has('auth-service')).toBe(true);
    expect(targets.has('payment-gateway')).toBe(true);
    expect(targets.has('scripts')).toBe(false);
  });
});

describe('runImagesBuild Engine & Router', () => {
  let repoRoot: string;

  // Hook up your unified console mitigation and spawn state context utility
  const testContext = setupOrchestratorTestContext();

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'crew-docker-build-'));
    writeFileSync(join(repoRoot, 'backstage.json'), '{}', 'utf8');
    vi.spyOn(process, 'cwd').mockReturnValue(repoRoot);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (repoRoot) rmSync(repoRoot, { recursive: true, force: true });
  });

  it('assembles a local development target image correctly using --load strategy', async () => {
    const servicePath = join(repoRoot, 'packages/gateway-service');
    mkdirSync(servicePath, { recursive: true });
    writeFileSync(join(servicePath, 'Dockerfile'), 'FROM scratch', 'utf8');

    await runImagesBuild({
      target: 'gateway-service',
      registry: 'local',
      imageTag: 'debug-v1',
    });

    expect(spawnSync).toHaveBeenCalledWith(
      'docker',
      ['buildx', 'build', '--load', '-t', 'local/gateway-service:debug-v1', '-f', 'packages/gateway-service/Dockerfile', '.'],
      expect.any(Object)
    );
    expect(spawnSync).toHaveBeenCalledWith('docker', ['image', 'prune', '-f'], expect.any(Object));
  });

  it('switches build action strategy to --push when executing inside a CI context', async () => {
    vi.stubEnv('CI', 'true');
    const servicePath = join(repoRoot, 'packages/worker-service');
    mkdirSync(servicePath, { recursive: true });
    writeFileSync(join(servicePath, 'Dockerfile'), 'FROM scratch', 'utf8');

    await runImagesBuild({
      target: 'worker-service',
      registry: 'ghcr.io/ai-crew-suite',
      imageTag: 'latest',
    });

    expect(spawnSync).toHaveBeenCalledWith(
      'docker',
      ['buildx', 'build', '--push', '-t', 'ghcr.io/ai-crew-suite/workbench-worker-service:latest', '-f', 'packages/worker-service/Dockerfile', '.'],
      expect.any(Object)
    );
  });

  it('aborts cascading sequence early if a sub-compilation returns a non-zero exit status', async () => {
    const servicePath = join(repoRoot, 'packages/faulty-service');
    mkdirSync(servicePath, { recursive: true });
    writeFileSync(join(servicePath, 'Dockerfile'), 'FROM scratch', 'utf8');

    // Force spawnSync execution pipeline status to register an execution error failure code
    testContext.mockSequenceStatuses(1);

    await expect(runImagesBuild({
      target: 'faulty-service',
      registry: 'local',
      imageTag: 'latest',
    })).rejects.toThrow('Docker compilation process failed with exit code 1');
  });
});
