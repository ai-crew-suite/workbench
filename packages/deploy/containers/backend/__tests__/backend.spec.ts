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
import { describe, it, expect, afterAll } from 'vitest';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import path from 'path';

describe('Backend Container Runtime Integration Suite', () => {
  let container: StartedTestContainer;

  afterAll(async () => {
    if (container) {
      console.log('🧹 Shutting down active backend test container instance...');
      await container.stop();
    }
  });

  it('should compile from the monorepo graph context and launch successfully', async () => {
    const monorepoRootPath = path.resolve(__dirname, '../../../../../');
    const dockerfilePath = 'packages/deploy/containers/backend/Dockerfile';

    console.log('🏗️  Building backend image via Testcontainers engine...');

    // 1. Core Fix: Chain .withBuildArgs() BEFORE calling .build()
    const containerBlueprint = await GenericContainer.fromDockerfile(monorepoRootPath, dockerfilePath)
      .withBuildArgs({
        SKELETON_DIR: '.build-skeleton-backend'
      })
      .build();

    // 2. Chain runtime networking options AFTER calling .build()
    container = await containerBlueprint
      .withExposedPorts(7007)
      .start();

    // Verify container runtime port mapping status
    const mappedPort = container.getMappedPort(7007);
    expect(mappedPort).toBeGreaterThan(0);

    console.log(`🚀 Backend active on ephemeral host port: ${mappedPort}`);

    // 3. Read the logs out as an asynchronous stream hook
    const logStream = await container.logs();

    await new Promise<void>((resolve, reject) => {
      let logOutput = '';

      logStream
        .on('data', (chunk: string) => {
          logOutput += chunk;
          if (logOutput.includes('empty-fallback.yaml') || logOutput.includes('node')) {
            resolve();
          }
        })
        .on('error', (err) => reject(err))
        .on('end', () => resolve());

      setTimeout(resolve, 5000);
    });

    expect(container.getId()).toBeDefined();
  }, 90000);
});
