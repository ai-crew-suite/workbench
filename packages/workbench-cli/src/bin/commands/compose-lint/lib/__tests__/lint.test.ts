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

// Declare functions within vi.hoisted to survive early hoisting execution safely
const { mockLintFiles, mockFormatResults } = vi.hoisted(() => ({
  mockLintFiles: vi.fn(),
  mockFormatResults: vi.fn(),
}));

vi.mock('dclint', () => {
  // Construct a concrete class representation that maps methods to the hoisted tracking spies
  class MockDCLinter {
    lintFiles = mockLintFiles;
    formatResults = mockFormatResults;
  }

  return {
    DCLinter: MockDCLinter,
  };
});

vi.mock('../../../utils/workspace', () => ({
  findRepoRoot: () => process.cwd(),
}));

import { runComposeLint } from '../lint.js';

describe('runComposeLint Programmatic Engine', () => {
  let repoRoot: string;

  beforeEach(() => {
    vi.resetAllMocks();
    repoRoot = mkdtempSync(join(tmpdir(), 'crew-compose-lint-'));
    vi.spyOn(process, 'cwd').mockReturnValue(repoRoot);

    // Set standard passing defaults for the testing scope
    mockLintFiles.mockReturnValue([]);
    mockFormatResults.mockResolvedValue('');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (repoRoot) rmSync(repoRoot, { recursive: true, force: true });
  });

  it('runs programmatic compilation on resolved explicit directories', async () => {
    const servicePath = join(repoRoot, 'packages/deploy/compose');
    mkdirSync(join(servicePath, 'src'), { recursive: true });

    const targetFile = join(servicePath, 'src/compose.yml');
    writeFileSync(targetFile, 'services:\n  web:\n    image: nginx', 'utf8');

    await runComposeLint({ target: 'packages/deploy/compose' });

    expect(mockLintFiles).toHaveBeenCalledWith([targetFile], false);
  });

  it('throws an error cleanly if error counts rise above zero threshold bounds', async () => {
    const customPath = join(repoRoot, 'compose.yml');
    writeFileSync(customPath, 'services:\n  redis:\n    image: redis', 'utf8');

    // Populate mock returns with rule-breaking configuration fixtures
    mockLintFiles.mockReturnValue([{ errorCount: 2, warningCount: 0, results: [] }]);
    mockFormatResults.mockResolvedValue('line 1: breaking rule schema violation configuration format');

    await expect(runComposeLint({ target: 'compose.yml' })).rejects.toThrow(
      'Compose engine verification failed with 2 schema rule breaks.'
    );
    expect(mockFormatResults).toHaveBeenCalled();
  });
});
