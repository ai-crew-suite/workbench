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
// packages/workbench-cli/src/bin/commands/seed-wiremock/__tests__/seeder.test.ts
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Strict Rule Alignment: Top-of-file manual hoisting definitions for child processes / file layers
vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
  },
}));

vi.mock('@ai-crew-suite/fixtures-external', () => ({
  getAllProgrammaticMappings: vi.fn(() => [{ name: 'mock-external-route', request: {}, response: {} }]),
}));

vi.mock('@ai-crew-suite/fixtures-kubernetes', () => ({
  getAllKubernetesMappings: vi.fn(() => [{ name: 'mock-k8s-core-pod', request: {}, response: {} }]),
}));

import fs from 'node:fs';
import { runWiremockSeeder } from '../seeder';
import { WireMockClient } from '../wiremock-client';

describe('WireMock Seeder Orchestrator Service', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'mocked-registration-uuid' }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('routes correctly to internal programmatic external package fixtures', async () => {
    const registerSpy = vi.spyOn(WireMockClient.prototype, 'registerStub');

    await runWiremockSeeder({
      source: 'external',
      port: '8080',
      host: 'localhost',
      clear: false,
    });

    expect(registerSpy).toHaveBeenCalledTimes(1);
    expect(registerSpy).toHaveBeenCalledWith(expect.objectContaining({ name: 'mock-external-route' }));
  });

  it('triggers a clear dynamic reset sequence if requested by option parameters', async () => {
    const resetSpy = vi.spyOn(WireMockClient.prototype, 'clearDynamicMocks').mockResolvedValue();

    await runWiremockSeeder({
      source: 'kubernetes',
      port: '8080',
      host: 'localhost',
      clear: true,
    });

    expect(resetSpy).toHaveBeenCalledTimes(1);
  });

  it('attempts to resolve file payloads manually when custom strings are supplied', async () => {
    vi.mocked(fs.existsSync).mockReturnValueOnce(true);
    vi.mocked(fs.readFileSync).mockReturnValueOnce(JSON.stringify([{ name: 'custom-file-route', request: {}, response: {} }]));

    const registerSpy = vi.spyOn(WireMockClient.prototype, 'registerStub');

    await runWiremockSeeder({
      source: '/path/to/custom-fixtures.json',
      port: '8080',
      host: '127.0.0.1',
      clear: false,
    });

    expect(registerSpy).toHaveBeenCalledWith(expect.objectContaining({ name: 'custom-file-route' }));
  });

  it('throws structured errors if a custom path value points to a non-existent asset location', async () => {
    vi.mocked(fs.existsSync).mockReturnValueOnce(false);

    await expect(
      runWiremockSeeder({
        source: '/missing/asset.json',
        port: '8080',
        host: 'localhost',
        clear: false,
      })
    ).rejects.toThrow(/Invalid source layout reference/);
  });
});
