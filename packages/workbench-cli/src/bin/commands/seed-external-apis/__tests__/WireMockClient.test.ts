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
import { beforeEach, describe, it, expect, vi, afterEach } from 'vitest';
import { WireMockClient } from '../WireMockClient';
import fs from 'fs';

// Mock the file system completely
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
  },
}));

describe('WireMockClient (Robust Version)', () => {
  let client: WireMockClient;
  const baseUrl = 'http://localhost:9999';

  beforeEach(() => {
    // Set a very short timeout window for tests so timeout testing is instant
    client = new WireMockClient(baseUrl, { timeoutMs: 50 });
    vi.stubEnv('MOCK_PROXY_URL', '');
    vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Timeout Handling Mechanics', () => {
    it('throws a descriptive error when a request exceeds the timeout threshold', async () => {
      // Direct mock of fetch throwing an AbortError DOMException simulating a real timeout event
      vi.mocked(global.fetch).mockRejectedValueOnce({
        name: 'AbortError',
        message: 'The user aborted a request.',
      });

      await expect(client.clearDynamicMocks()).rejects.toThrow(
        '[WireMock] Network request timed out after 50ms targeting: http://localhost:9999/__admin/mappings/reset'
      );
    });
  });

  describe('constructor initialization', () => {
    it('uses fallback URL if no parameters or environment variables are provided', () => {
      const defaultClient = new WireMockClient();
      expect((defaultClient as any).adminUrl).toBe('http://localhost:8080/__admin');
    });

    it('prefers environment variables when parameter injection is missing', () => {
      vi.stubEnv('MOCK_PROXY_URL', 'http://env-host:7000/');
      const envClient = new WireMockClient();
      expect((envClient as any).adminUrl).toBe('http://env-host:7000/__admin');
    });
  });

  describe('registerStub', () => {
    it('successfully registers a payload object and yields a target uuid mapping', async () => {
      const mockStub = { request: { url: '/test' }, response: { status: 200 } };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'uuid-123' }),
      } as Response);

      const id = await client.registerStub(mockStub);

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:9999/__admin/mappings', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(mockStub),
      }));
      expect(id).toBe('uuid-123');
    });

    it('throws custom description errors if endpoint throws an application bad code', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        text: async () => 'Error text signature parsing validation issue',
      } as Response);

      await expect(client.registerStub({})).rejects.toThrow(
        '[WireMock] Failed stub ingestion: Error text signature parsing validation issue'
      );
    });
  });

  describe('clearDynamicMocks', () => {
    it('throws an error if server returns non-ok response on resets', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        text: async () => 'Reset endpoint disabled',
      } as Response);

      await expect(client.clearDynamicMocks()).rejects.toThrow(
        '[WireMock] Failed to reset mappings: Reset endpoint disabled'
      );
    });
  });

  describe('verifyRequestEmitted', () => {
    it('throws an error if count endpoint fails validation parameters', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        text: async () => 'Bad query pattern type mapping format',
      } as Response);

      await expect(client.verifyRequestEmitted('GET', '*')).rejects.toThrow(
        '[WireMock] Failed request count verification: Bad query pattern type mapping format'
      );
    });
  });

  describe('uploadDirectory Extended Path Safeties', () => {
    it('logs a warning statement using console.warn when targeted path does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(false);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await client.uploadDirectory('/missing/path/to/mocks');

      expect(warnSpy).toHaveBeenCalledWith(
        '[WireMock Bootstrapper] Target directory not found at path: /missing/path/to/mocks'
      );
      expect(fs.readdirSync).not.toHaveBeenCalled();
    });

    it('processes single object structures inside structural valid arrays clean', async () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(true);
      vi.mocked(fs.readdirSync).mockReturnValueOnce(['mock.json'] as any);
      vi.mocked(fs.readFileSync).mockReturnValueOnce('[{"url": "/route-a"}, {"url": "/route-b"}]');

      const registerSpy = vi.spyOn(client, 'registerStub').mockResolvedValue('registered-uuid');

      await client.uploadDirectory('/mocks');

      expect(registerSpy).toHaveBeenCalledTimes(2);
      expect(registerSpy).toHaveBeenNthCalledWith(1, { url: '/route-a' });
      expect(registerSpy).toHaveBeenNthCalledWith(2, { url: '/route-b' });
    });
  });
});
