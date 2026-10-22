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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { findRepoRoot } from '../workspace';

describe('Workspace Context Utilities Engine', () => {
  const mockCwd = '/home/user/repo/packages/my-package';

  beforeEach(() => {
    // Lock process.cwd and cleanly spy on the native file system hooks
    vi.spyOn(process, 'cwd').mockReturnValue(mockCwd);
    vi.spyOn(fs, 'existsSync');
    vi.spyOn(fs, 'readFileSync');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('findRepoRoot()', () => {
    it('should successfully climb the tree until it finds backstage.json', () => {
      vi.mocked(fs.existsSync).mockImplementation((targetPath: unknown) => {
        if (typeof targetPath === 'string') {
          const normalized = targetPath.replace(/\\/g, '/');
          return normalized === '/home/user/repo/backstage.json';
        }
        return false;
      });

      const calculatedRoot = findRepoRoot(mockCwd);
      expect(calculatedRoot).toBe('/home/user/repo');
    });

    it('should fall back to start directory context if backstage.json is absent', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const calculatedRoot = findRepoRoot(mockCwd);
      expect(calculatedRoot).toBe(mockCwd);
    });

    it('should terminate cleanly and return the start directory when climbing hits the file system root boundary', () => {
      // Simulate backstage.json never existing at any level of the file system
      vi.mocked(fs.existsSync).mockReturnValue(false);

      // We trigger the execution from the actual host root folder ('/')
      const filesystemRoot = '/';

      const calculatedRoot = findRepoRoot(filesystemRoot);

      // Guard assertion: It must exit immediately on the root match and safely return the fallback location context
      expect(calculatedRoot).toBe(filesystemRoot);
    });
  });
});
