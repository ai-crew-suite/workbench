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
import { execSync } from 'node:child_process';
import { describe, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Dynamically resolves the exact pre-built image tag using the package namespace context.
 * Points cleanly to the local storage target context to prevent unwanted remote registry pulling.
 */
function resolveTestImageContext(): string {
  const pkgJsonPath = path.resolve(__dirname, '../package.json');
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  const cleanTargetName = pkgJson.name.split('/').pop() || ''; // Yields 'prometheus' or 'workbench-prometheus'

  // Normalize name if the package name is explicitly prefixed
  const normalizedName = cleanTargetName.replace(/^workbench-/, '');

  const imageTag = process.env['IMAGE_TAG'] || 'latest';
  return `local/${normalizedName}:${imageTag}`;
}

describe('Prometheus Container Structure Suite', () => {
  it('should pass all configuration file structure assertions', () => {
    const targetImage = resolveTestImageContext();
    const configPath = path.resolve(__dirname, './prometheus.cst.yaml');

    try {
      // Execute the structural structure testing harness matching the platform design pattern
      execSync(
        `container-structure-test test \
          --image ${targetImage} \
          --config ${configPath}`,
        { stdio: ['pipe', 'pipe', 'pipe'], env: process.env }
      );
    } catch (error: any) {
      const output = error.stdout?.toString() || '';
      const stderr = error.stderr?.toString() || '';

      console.error('\n❌ --- PROMETHEUS STRUCTURE TEST FAILURE BREAKDOWN ---');
      if (output) console.error(output);
      if (stderr) console.error(stderr);
      console.error('-------------------------------------------------------\n');

      throw new Error(`Structure assertion failed for ${targetImage}. See breakdown above.`);
    }
  });
});
