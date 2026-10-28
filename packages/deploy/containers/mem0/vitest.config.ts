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
import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for the container runtime integration suite.
 *
 * Every spec builds and boots real Docker images via Testcontainers, so test
 * files run sequentially to avoid concurrent image builds, with a generous
 * fallback timeout for tests that do not declare their own.
 */
export default defineConfig({
  test: {
    include: ['**/*.{test,spec}.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'node',
    testTimeout: 90_000,
    hookTimeout: 90_000,
    fileParallelism: false,
  },
});
