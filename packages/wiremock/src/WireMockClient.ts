import fs from 'fs';
import path from 'path';

export class WireMockClient {
  private adminUrl: string;

  constructor(baseUrl = process.env.MOCK_PROXY_URL || 'http://localhost:8080') {
    this.adminUrl = `${baseUrl.replace(/\/$/, '')}/__admin`;
  }

  async registerStub(stub: any): Promise<string> {
    const res = await fetch(`${this.adminUrl}/mappings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stub),
    });
    if (!res.ok) throw new Error(`[WireMock] Failed stub ingestion: ${await res.text()}`);
    const data = await res.json() as { id: string };
    return data.id;
  }

  async clearDynamicMocks(): Promise<void> {
    await fetch(`${this.adminUrl}/mappings/reset`, { method: 'POST' });
  }

  async verifyRequestEmitted(method: string, urlPattern: string): Promise<boolean> {
    const res = await fetch(`${this.adminUrl}/requests/count`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, urlPattern }),
    });
    const data = await res.json() as { count: number };
    return data.count > 0;
  }

  /**
   * Reads a folder containing WireMock JSON mappings and pushes them directly into the API plane
   */
  async uploadDirectory(directoryPath: string): Promise<void> {
    if (!fs.existsSync(directoryPath)) return;

    const files = fs.readdirSync(directoryPath);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(directoryPath, file);
        try {
          const mappingData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          // Handle arrays of mappings or single objects gracefully
          const mappings = Array.isArray(mappingData) ? mappingData : [mappingData];
          for (const stub of mappings) {
            await this.registerStub(stub);
          }
          console.info(`[WireMock Bootstrapper] Successfully loaded mock blueprint: ${file}`);
        } catch (err: any) {
          console.error(`[WireMock Bootstrapper] Malformed JSON mapping in ${file}: ${err.message}`);
        }
      }
    }
  }
}
