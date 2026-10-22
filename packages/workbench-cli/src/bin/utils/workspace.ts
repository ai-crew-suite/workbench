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
import path from 'node:path';

/**
 * Dynamically traverses upward from a given directory to locate the unique 'backstage.json' root anchor.
 */
export function findRepoRoot(startDir: string = process.cwd()): string {
  let currentDir = startDir;

  while (currentDir !== path.dirname(currentDir)) {
    if (fs.existsSync(path.resolve(currentDir, 'backstage.json'))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  // Fallback case to avoid infinite loop parameters if file isn't present during dev setups
  return startDir;
}
