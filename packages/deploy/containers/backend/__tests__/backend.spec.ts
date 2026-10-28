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
import { describe, expect, it } from 'vitest';
import { GenericContainer, Wait } from 'testcontainers';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Dynamically resolves the exact pre-built image tag using the package namespace context.
 * Eliminates fragile relative folder references to the monorepo root.
 */
function resolveTestImageContext(): string {
  const pkgJsonPath = path.resolve(__dirname, '../package.json');
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  const cleanTargetName = pkgJson.name.split('/').pop() || ''; // Yields 'backend'

  const imageTag = process.env['IMAGE_TAG'] || 'latest';
  return `local/${cleanTargetName}:${imageTag}`;
}

describe('Backend Development Runner Integration Suite', () => {
  it('executes the Node runtime within the pre-built distribution artifact', async () => {
    const targetImage = resolveTestImageContext();

    // Consume the pre-built image from the local Docker engine storage context
    const container = await new GenericContainer(targetImage)
      .withCommand([
        'node',
        '-e',
        "console.log('backend development runner ready')",
      ])
      .withWaitStrategy(Wait.forLogMessage('backend development runner ready'))
      .start();

    try {
      expect(container.getId()).toBeDefined();

      // Optional Quality Control Assertion: Ensure no temporary workbench files leaked into root
      const execResult = await container.exec(['ls', '-a']);
      expect(execResult.stdout).not.toContain('.workbench-cache');

    } finally {
      // Guaranteed resource teardown to prevent trailing orphaned containers
      await container.stop();
    }
  }, 30000); // Reduced timeout from 90000ms to 30000ms because there is no heavy compile layer phase
});
