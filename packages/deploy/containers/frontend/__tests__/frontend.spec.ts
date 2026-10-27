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
import path from 'path';
import { GenericContainer, Wait } from 'testcontainers';
import { describe, expect, it } from 'vitest';

describe('Frontend Development Runner Integration Suite', () => {
  it('builds without workbench artifacts and executes the Node runtime', async () => {
    const monorepoRootPath = path.resolve(__dirname, '../../../../../');
    const dockerfilePath = 'packages/deploy/containers/frontend/Dockerfile';
    const image = await GenericContainer.fromDockerfile(
      monorepoRootPath,
      dockerfilePath,
    ).build();
    const container = await image
      .withCommand([
        'node',
        '-e',
        "console.log('frontend development runner ready')",
      ])
      .withWaitStrategy(Wait.forLogMessage('frontend development runner ready'))
      .start();

    try {
      expect(container.getId()).toBeDefined();
    } finally {
      await container.stop();
    }
  }, 90000);
});
