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
import { describe, it } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveTestImageContext(): string {
  const pkgJsonPath = path.resolve(__dirname, '../package.json');
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  const cleanTargetName = pkgJson.name.split('/').pop() || ''; // Yields 'temporal-container'

  const imageTag = process.env['IMAGE_TAG'] || 'latest';
  return `local/${cleanTargetName}:${imageTag}`;
}

describe('Temporal Custom Infrastructure Image Structure Suite', () => {
  it('should pass all binary placement and metadata structure assertions', () => {
    const targetImage = resolveTestImageContext();
    const configPath = path.resolve(__dirname, './temporal.cst.yaml');

    try {
      execSync(
        `container-structure-test test \
          --image ${targetImage} \
          --config ${configPath}`,
        { stdio: ['pipe', 'pipe', 'pipe'], env: process.env }
      );
    } catch (error: any) {
      const output = error.stdout?.toString() || '';
      const stderr = error.stderr?.toString() || '';

      console.error('\n❌ --- CONTAINER STRUCTURE TEST FAILURE BREAKDOWN ---');
      if (output) console.error(output);
      if (stderr) console.error(stderr);
      console.error('-------------------------------------------------------\n');

      throw new Error(`Structure assertion failed for ${targetImage}. See breakdown above.`);
    }
  });
});
