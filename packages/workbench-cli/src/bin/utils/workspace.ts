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
import fs from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * Dynamically traverses upward from a given directory to locate the unique 'backstage.json' root anchor.
 */
export function findRepoRoot(startDir: string = process.cwd()): string {
  let currentDir = startDir;

  while (currentDir !== dirname(currentDir)) {
    if (fs.existsSync(resolve(currentDir, 'backstage.json'))) {
      return currentDir;
    }
    currentDir = dirname(currentDir);
  }

  // Fallback case to avoid infinite loop parameters if file isn't present during dev setups
  return startDir;
}

/**
 * Discovers container directories by looking for folders that contain a Dockerfile
 */
export function discoverContainerTargets(repoRoot: string): Map<string, string> {
  const targets = new Map<string, string>();

  const searchPaths = [
    join(repoRoot, 'packages/deploy/containers'),
    join(repoRoot, 'packages'),
  ];

  function scan(dir: string) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);

    if (files.includes('Dockerfile') && !dir.includes('node_modules')) {
      const name = basename(dir);
      targets.set(name, dir);
      return;
    }

    for (const file of files) {
      const fullPath = join(dir, file);
      if (
        fs.statSync(fullPath).isDirectory() &&
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
