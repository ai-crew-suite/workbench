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
import { execSync } from 'child_process';
import { describe, it, expect } from 'vitest';
import path from 'path';

describe('Temporal Custom Infrastructure Image Structure Suite', () => {
  const registry = process.env['REGISTRY'] || 'localhost:32443/ai-crew-suite';
  const tag = process.env['IMAGE_TAG'] || 'latest';
  const targetImage = `${registry}/workbench-temporal:${tag}`;

  it('should pass all binary placement and metadata structure assertions', () => {
    try {
      const configPath = path.resolve(__dirname, './temporal.cst.yaml');

      const result = execSync(
        `container-structure-test test \
          --image ${targetImage} \
          --config ${configPath}`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );

      expect(result).toContain('PASS');
    } catch (error: any) {
      console.error('❌ Temporal Structural Assertions Failed:\n', error.stdout || error.message);
      throw error;
    }
  });
});
