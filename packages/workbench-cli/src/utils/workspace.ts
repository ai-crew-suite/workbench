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
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * Dynamically traverses upward from a given directory to locate the unique 'backstage.json' root anchor.
 */
export function findRepoRoot(startDir: string = process.cwd()): string {
  let currentDir = startDir;

  while (currentDir !== dirname(currentDir)) {
    if (existsSync(resolve(currentDir, 'backstage.json'))) {
      return currentDir;
    }
    currentDir = dirname(currentDir);
  }
  return startDir;
}

/**
 * Discovers container directories by looking for folders containing a Dockerfile,
 * indexing them strictly by their official package name tail (e.g. 'temporal-container').
 */
export function discoverContainerTargets(repoRoot: string): Map<string, string> {
  const targets = new Map<string, string>();

  const searchPaths = [
    join(repoRoot, 'packages/deploy/containers'),
    join(repoRoot, 'packages'),
  ];

  function scan(dir: string) {
    if (!existsSync(dir)) return;
    const files = readdirSync(dir);

    if (files.includes('Dockerfile') && !dir.includes('node_modules')) {
      try {
        const pkgJsonPath = join(dir, 'package.json');
        if (existsSync(pkgJsonPath)) {
          const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
          if (pkgJson.name) {
            // Extracts 'temporal-container' from '@ai-crew-suite/temporal-container'
            const cleanName = pkgJson.name.split('/').pop();
            if (cleanName) {
              targets.set(cleanName, dir);
              return;
            }
          }
        }
      } catch {
        // Fallback to directory name if JSON parsing fails
      }

      const fallbackName = basename(dir);
      targets.set(fallbackName, dir);
      return;
    }

    for (const file of files) {
      const fullPath = join(dir, file);
      if (
        statSync(fullPath).isDirectory() &&
        !file.startsWith('.') &&
        file !== 'node_modules' &&
        file !== 'dist' &&
        file !== 'scripts' &&
        file !== '__tests__'
      ) {
        scan(fullPath);
      }
    }
  }

  searchPaths.forEach(scan);
  return targets;
}

/**
 * Checks if a specific command binary exists on the host machine path environment
 */
export function hasBinary(binaryName: string): boolean {
  const checkCmd = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(checkCmd, [binaryName], { stdio: 'ignore' });
  return result.status === 0;
}
