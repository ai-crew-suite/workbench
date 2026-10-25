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
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import path from 'path';

describe('Container Runtime Integration Matrix', () => {
  let backendContainer: StartedTestContainer;
  let prometheusContainer: StartedTestContainer;

  // Cleanup layer to guarantee zero rogue containers are left on host
  afterAll(async () => {
    if (backendContainer) await backendContainer.stop();
    if (prometheusContainer) await prometheusContainer.stop();
  });

  it('should successfully launch backend container and pull healthy status', async () => {
    // Instruct Testcontainers to automatically resolve the context directory
    const contextPath = path.resolve(__dirname, '../backend');

    const container = await GenericContainer.fromDockerfile(contextPath)
      .withBuildArgs({ NODE_ENV: 'production' })
      .withExposedPorts(8080)
      .build();

    backendContainer = await container.start();
    const mappedPort = backendContainer.getMappedPort(8080);

    // Hit the service runtime directly over the ephemeral port safely isolated from other test instances
    const response = await fetch(`http://localhost:${mappedPort}/health`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('up');
  }, 45000); // 45s allowance for underlying docker build overhead

  it('should verify prometheus configuration initializes correctly', async () => {
    const contextPath = path.resolve(__dirname, '../prometheus');

    const container = await GenericContainer.fromDockerfile(contextPath)
      .withExposedPorts(9090)
      .build();

    prometheusContainer = await container.start();
    const mappedPort = prometheusContainer.getMappedPort(9090);

    const response = await fetch(`http://localhost:${mappedPort}/-/healthy`);
    expect(response.status).toBe(200);
  }, 45000);
});
