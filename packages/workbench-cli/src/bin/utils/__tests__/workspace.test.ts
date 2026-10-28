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
import { join } from 'node:path';

// Virtualize filesystem checks completely to preserve hermetic test isolation
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  // Shared mock instances guarantee the default export view and the named export
  // bindings observed by the module under test reference the exact same test doubles
  const mocked = {
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
    readFileSync: vi.fn(),
  };
  return {
    ...actual,
    ...mocked,
    default: { ...actual, ...mocked },
  };
});

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}));

import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { findRepoRoot, discoverContainerTargets, hasBinary } from '../workspace.js';

describe('Workspace Context Utilities Engine', () => {
  const mockCwd = '/home/user/repo/packages/my-package';
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(process, 'cwd').mockReturnValue(mockCwd);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  describe('findRepoRoot()', () => {
    it('should successfully climb the tree until it finds backstage.json', () => {
      vi.mocked(fs.existsSync).mockImplementation((targetPath: any) => {
        if (typeof targetPath === 'string') {
          const normalized = targetPath.replace(/\\/g, '/');
          // Only the exact repo root anchor resolves; nested directories must miss
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
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const filesystemRoot = '/';
      const calculatedRoot = findRepoRoot(filesystemRoot);

      expect(calculatedRoot).toBe(filesystemRoot);
    });
  });

  describe('discoverContainerTargets()', () => {
    const fakeRepoRoot = '/home/user/repo';

    it('should accurately return an empty map if search directories do not exist on the file system', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const targets = discoverContainerTargets(fakeRepoRoot);
      expect(targets.size).toBe(0);
    });

    it('should scan packages and correctly extract directories containing a Dockerfile', () => {
      vi.mocked(fs.existsSync).mockImplementation((dirPath: any) => {
        if (typeof dirPath === 'string') {
          const normalized = dirPath.replace(/\\/g, '/');
          return [
            '/home/user/repo/packages',
            '/home/user/repo/packages/auth-service',
            '/home/user/repo/packages/deploy/containers',
            '/home/user/repo/packages/auth-service/package.json'
          ].some(p => normalized === p);
        }
        return false;
      });

      vi.mocked(fs.readdirSync).mockImplementation((dirPath: any) => {
        if (typeof dirPath === 'string') {
          const normalized = dirPath.replace(/\\/g, '/');
          if (normalized === '/home/user/repo/packages') {
            return ['auth-service', 'deploy'] as any;
          }
          if (normalized === '/home/user/repo/packages/auth-service') {
            return ['Dockerfile', 'package.json'] as any;
          }
        }
        return [] as any;
      });

      vi.mocked(fs.statSync).mockImplementation((itemPath: any) => {
        if (typeof itemPath === 'string') {
          const normalized = itemPath.replace(/\\/g, '/');
          const isDir = [
            '/home/user/repo/packages/auth-service',
            '/home/user/repo/packages/deploy'
          ].some(p => normalized === p || normalized.startsWith(p));

          return { isDirectory: () => isDir } as any;
        }
        return { isDirectory: () => false } as any;
      });

      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ name: '@ai-crew-suite/auth-service' }));

      const targets = discoverContainerTargets(fakeRepoRoot);

      expect(targets.has('auth-service')).toBe(true);
      expect(targets.get('auth-service')).toBe(join(fakeRepoRoot, 'packages/auth-service'));
    });
  });

  describe('hasBinary()', () => {
    it('should determine target system operating platform and leverage matching lookup selectors', () => {
      vi.mocked(spawnSync).mockReturnValue({ status: 0 } as any);

      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      expect(hasBinary('hadolint')).toBe(true);
      expect(spawnSync).toHaveBeenCalledWith('which', ['hadolint'], { stdio: 'ignore' });

      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      expect(hasBinary('hadolint')).toBe(true);
      expect(spawnSync).toHaveBeenLastCalledWith('where', ['hadolint'], { stdio: 'ignore' });
    });

    it('should return false if the child status evaluation yields a non-zero exit state code', () => {
      vi.mocked(spawnSync).mockReturnValue({ status: 1 } as any);
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

      expect(hasBinary('invalid-binary')).toBe(false);
    });
  });
});
