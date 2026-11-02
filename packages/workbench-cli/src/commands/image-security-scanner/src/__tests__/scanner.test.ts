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

import { setupOrchestratorTestContext } from '../../../../utils/test-utils';
import { runSecurityScanner } from '../scanner';
import { writeImageReceipt } from '../../../../utils/oci/image-receipt';
import { runProcess } from '../../../../utils/run-process';

vi.mock('../../../../utils/run-process', () => ({ runProcess: vi.fn() }));

describe('runSecurityScanner Engine & Router', () => {
  const imageId = `sha256:${'a'.repeat(64)}`;
  let repoRoot: string;
  const testContext = setupOrchestratorTestContext();
  function prepareTarget(servicePath: string, target: string): void {
    mkdirSync(servicePath, { recursive: true });
    writeFileSync(join(servicePath, 'Dockerfile'), 'FROM scratch', 'utf8');
    writeImageReceipt(servicePath, {
      version: 1, target, imageId, localTag: `local/${target}:sha256-${'a'.repeat(64)}`,
      platform: 'linux/amd64', publications: {},
    });
  }

  beforeEach(() => {
    vi.mocked(runProcess).mockResolvedValue(undefined);
    repoRoot = mkdtempSync(join(tmpdir(), 'crew-security-test-'));
    writeFileSync(join(repoRoot, 'backstage.json'), '{}', 'utf8');
    vi.spyOn(process, 'cwd').mockReturnValue(repoRoot);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (repoRoot) rmSync(repoRoot, { recursive: true, force: true });
  });

  it('runs localized native trivy execution path if binary is discovered on target host', async () => {
    const servicePath = join(repoRoot, 'packages/secure-service');
    prepareTarget(servicePath, 'secure-service');

    // First call check finding system path binary passes (0), runner process executes successfully (0)
    testContext.mockSequenceStatuses(0);

    await runSecurityScanner({ target: 'secure-service', scanTimeout: '15m' });

    expect(runProcess).toHaveBeenCalledWith(
      'trivy',
      ['image', '--timeout', '15m', '--severity', 'HIGH,CRITICAL', '--exit-code', '1', imageId]
    );
  });

  it('falls back seamlessly to docker mounting bridge if host binaries are absent', async () => {
    const servicePath = join(repoRoot, 'packages/fallback-service');
    prepareTarget(servicePath, 'fallback-service');

    // First call binary check returns not found (1), fallback runtime process completes with zero error output (0)
    testContext.mockSequenceStatuses(1);

    await runSecurityScanner({ target: 'fallback-service', scanTimeout: '10m' });

    expect(runProcess).toHaveBeenCalledWith(
      'docker',
      [
        'run', '--rm',
        '-v', '/var/run/docker.sock:/var/run/docker.sock',
        '-v', expect.stringContaining('.cache/trivy:/root/.cache'),
        'aquasec/trivy:latest',
        'image', '--timeout', '10m', '--severity', 'HIGH,CRITICAL', '--exit-code', '1', imageId
      ]
    );
  });

  it('aborts process and throws error immediately if vulnerability issues are flagged', async () => {
    const servicePath = join(repoRoot, 'packages/vulnerable-service');
    prepareTarget(servicePath, 'vulnerable-service');

    // Host check passes (0), but scanner returns violation rule code (1)
    testContext.mockSequenceStatuses(0);
    vi.mocked(runProcess).mockRejectedValueOnce(new Error('trivy failed'));

    await expect(runSecurityScanner({ target: 'vulnerable-service', scanTimeout: '15m' })).rejects.toThrow(
      'trivy failed'
    );
  });
});
