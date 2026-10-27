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
import { runSecurityScanner } from '../scanner';

describe('runSecurityScanner Engine & Router', () => {
  let repoRoot: string;
  const testContext = setupOrchestratorTestContext();

  beforeEach(() => {
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
    mkdirSync(servicePath, { recursive: true });
    writeFileSync(join(servicePath, 'Dockerfile'), 'FROM scratch', 'utf8');

    // First call check finding system path binary passes (0), runner process executes successfully (0)
    testContext.mockSequenceStatuses(0, 0);

    await runSecurityScanner({ target: 'secure-service', scanTimeout: '15m' });

    expect(spawnSync).toHaveBeenCalledWith(
      'trivy',
      ['image', '--timeout', '15m', '--severity', 'HIGH,CRITICAL', '--exit-code', '1', 'local/secure-service:latest'],
      expect.any(Object)
    );
  });

  it('falls back seamlessly to docker mounting bridge if host binaries are absent', async () => {
    const servicePath = join(repoRoot, 'packages/fallback-service');
    mkdirSync(servicePath, { recursive: true });
    writeFileSync(join(servicePath, 'Dockerfile'), 'FROM scratch', 'utf8');

    // First call binary check returns not found (1), fallback runtime process completes with zero error output (0)
    testContext.mockSequenceStatuses(1, 0);

    await runSecurityScanner({ target: 'fallback-service', scanTimeout: '10m' });

    expect(spawnSync).toHaveBeenCalledWith(
      'docker',
      [
        'run', '--rm',
        '-v', '/var/run/docker.sock:/var/run/docker.sock',
        '-v', expect.stringContaining('.cache/trivy:/root/.cache'),
        'aquasec/trivy:latest',
        'image', '--timeout', '10m', '--severity', 'HIGH,CRITICAL', '--exit-code', '1', 'local/fallback-service:latest'
      ],
      expect.any(Object)
    );
  });

  it('aborts process and throws error immediately if vulnerability issues are flagged', async () => {
    const servicePath = join(repoRoot, 'packages/vulnerable-service');
    mkdirSync(servicePath, { recursive: true });
    writeFileSync(join(servicePath, 'Dockerfile'), 'FROM scratch', 'utf8');

    // Host check passes (0), but scanner returns violation rule code (1)
    testContext.mockSequenceStatuses(0, 1);

    await expect(runSecurityScanner({ target: 'vulnerable-service', scanTimeout: '15m' })).rejects.toThrow(
      'Security validation checks found policy violations on target vulnerable-service'
    );
  });
});
