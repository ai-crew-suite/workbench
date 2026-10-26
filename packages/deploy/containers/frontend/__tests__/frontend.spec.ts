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
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { Readable } from 'stream';
import path from 'path';

describe('Frontend Container Compilation Integration Suite', () => {
  let container: StartedTestContainer;

  afterAll(async () => {
    if (container) {
      console.log('🧹 Sweeping up frontend test container instance tracks...');
      await container.stop();
    }
  });

  it('should evaluate the workspace architecture matrix and invoke the builder shell cleanly', async () => {
    const monorepoRootPath = path.resolve(__dirname, '../../../../../');
    const dockerfilePath = 'packages/deploy/containers/frontend/Dockerfile';

    console.log('🏗️ Building frontend base compilation harness via Testcontainers engine...');

    // 1. Build the target image from the root monorepo structural graph context
    const containerBlueprint = await GenericContainer.fromDockerfile(monorepoRootPath, dockerfilePath)
      .withBuildArgs({
        SKELETON_DIR: '.build-skeleton-frontend'
      })
      .build();

    console.log('🚀 Starting frontend container instance execution stream...');

    // 2. Fix 1: Use the native Wait factory strategy to track the command engine invocation safely
    container = await containerBlueprint
      .withWaitStrategy(Wait.forLogMessage(/workbench-app|yarn/i))
      .start();

    expect(container.getId()).toBeDefined();

    // 3. Fix 2: Wrap logs array cleanly using Node's stream reader to clear the 'on' method typing failure
    const logBuffer = await container.logs();
    const logStream = Readable.from(logBuffer);

    const runtimeLogs = await new Promise<string>((resolve) => {
      let accumulatedOutput = '';
      logStream.on('data', (chunk) => {
        accumulatedOutput += chunk.toString();
      });
      logStream.on('end', () => resolve(accumulatedOutput));
      // Fallback safeguard constraint to protect build tracks
      setTimeout(() => resolve(accumulatedOutput), 4000);
    });

    console.log('📊 Captured Frontend Execution Log Trace Summary:\n', runtimeLogs);

    // Assert that the container targets your active application workspaces
    expect(runtimeLogs.toLowerCase()).toMatch(/(yarn|workspace|workbench-app)/);
  }, 90000);
});
