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
import { vi, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import type { WorkspaceContext } from '../utils/workspace';

// Note: consuming test files must call `vi.mock('node:child_process', ...)`
// themselves so it is hoisted above their own imports of '../orchestrate'.

export const mockWorkspaceContext: WorkspaceContext = {
  repoRoot: '/mock/repo/root',
  packageDir: '/mock/repo/root/packages/mock-package',
  packageName: '@ai-crew-suite/mock-package',
  role: 'node-library',
  isBrowser: false,
  isServer: true,
};

export function setupOrchestratorTestContext() {
  const originalExitCode = process.exitCode;

  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
    vi.spyOn(console, 'log').mockImplementation(() => { /* no-op */ });
    vi.spyOn(console, 'error').mockImplementation(() => { /* no-op */ });

    // Reset spy to a baseline working return value before every test run
    (spawnSync as any).mockReturnValue({ status: 0 });
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
  });

  return {
    mockSequenceStatuses(...statuses: number[]) {
      for (const status of statuses) {
        (spawnSync as any).mockReturnValueOnce({ status });
      }
    },
    mockAllSuccessful() {
      (spawnSync as any).mockReturnValue({ status: 0 });
    }
  };
}
