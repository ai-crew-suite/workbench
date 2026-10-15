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
import fs from 'fs';
import path from 'path';

export class WireMockClient {
  private readonly adminUrl: string;
  private readonly timeoutMs: number;

  constructor(
    baseUrl = process.env['MOCK_PROXY_URL'] || 'http://localhost:8080',
    options?: { timeoutMs?: number }
  ) {
    this.adminUrl = `${baseUrl.replace(/\/$/, '')}/__admin`;
    this.timeoutMs = options?.timeoutMs || 5000; // Safe default timeout prevents hanging processes
  }

  /**
   * Helper utility to handle fetch requests safely with a strict request timeout window
   */
  private async safeFetch(url: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      return response;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error(`[WireMock] Network request timed out after ${this.timeoutMs}ms targeting: ${url}`);
      }
      throw error;
    } finally {
      clearTimeout(id);
    }
  }

  async registerStub(stub: Record<string, any>): Promise<string> {
    const res = await this.safeFetch(`${this.adminUrl}/mappings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stub),
    });

    if (!res.ok) {
      throw new Error(`[WireMock] Failed stub ingestion: ${await res.text()}`);
    }

    const data = (await res.json()) as { id: string };
    return data.id;
  }

  async clearDynamicMocks(): Promise<void> {
    const res = await this.safeFetch(`${this.adminUrl}/mappings/reset`, { method: 'POST' });
    if (!res.ok) {
      throw new Error(`[WireMock] Failed to reset mappings: ${await res.text()}`);
    }
  }

  async verifyRequestEmitted(method: string, urlPattern: string): Promise<boolean> {
    const res = await this.safeFetch(`${this.adminUrl}/requests/count`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, urlPattern }),
    });

    if (!res.ok) {
      throw new Error(`[WireMock] Failed request count verification: ${await res.text()}`);
    }

    const data = (await res.json()) as { count: number };
    return data.count > 0;
  }

  /**
   * Reads a folder containing WireMock JSON mappings and pushes them directly into the API plane
   */
  async uploadDirectory(directoryPath: string): Promise<void> {
    if (!fs.existsSync(directoryPath)) {
      console.warn(`[WireMock Bootstrapper] Target directory not found at path: ${directoryPath}`);
      return;
    }

    const files = fs.readdirSync(directoryPath);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(directoryPath, file);
        try {
          const mappingData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          const mappings = Array.isArray(mappingData) ? mappingData : [mappingData];

          for (const stub of mappings) {
            await this.registerStub(stub);
          }
          console.info(`[WireMock Bootstrapper] Successfully loaded mock blueprint: ${file}`);
        } catch (err: any) {
          console.error(`[WireMock Bootstrapper] Malformed JSON mapping or ingestion crash in ${file}: ${err.message}`);
        }
      }
    }
  }
}

