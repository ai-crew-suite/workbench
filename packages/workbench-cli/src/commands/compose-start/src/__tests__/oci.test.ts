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
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchComposeArtifact } from '../oci';

vi.mock('../../../../utils/docker-auth', () => ({ resolveRegistryAuth: () => undefined }));

describe('fetchComposeArtifact', () => {
  let server: Server | undefined;
  let directory: string | undefined;

  afterEach(async () => {
    if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it('fetches and verifies the raw Compose layer from an OCI registry', async () => {
    const body = Buffer.from('services:\n  web:\n    image: nginx\n');
    const digest = `sha256:${createHash('sha256').update(body).digest('hex')}`;
    const requests: string[] = [];
    server = createServer((request, response) => {
      requests.push(request.url ?? '');
      if (request.url === '/v2/team/compose/manifests/latest') {
        response.setHeader('content-type', 'application/vnd.oci.image.manifest.v1+json');
        response.end(JSON.stringify({
          schemaVersion: 2,
          mediaType: 'application/vnd.oci.image.manifest.v1+json',
          layers: [{ mediaType: 'application/vnd.docker.compose.file+yaml', size: body.length, digest }],
        }));
      } else if (request.url === `/v2/team/compose/blobs/${digest}`) {
        response.setHeader('content-type', 'application/octet-stream');
        response.end(body);
      } else {
        response.writeHead(404).end();
      }
    });
    await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing test registry address');
    directory = await mkdtemp(join(tmpdir(), 'workbench-oci-test-'));
    const destinationPath = join(directory, 'compose.yml');

    await fetchComposeArtifact({ registry: `127.0.0.1:${address.port}/team`, tag: 'latest', destinationPath });
    expect(await readFile(destinationPath)).toEqual(body);
    expect(requests).toEqual([
      '/v2/team/compose/manifests/latest',
      `/v2/team/compose/blobs/${digest}`,
    ]);
  });

  it.each(['missing layer', 'invalid size', 'wrong digest', 'wrong size'])(
    'rejects %s without replacing the cached Compose file',
    async scenario => {
      const body = Buffer.from('services: {}\n');
      const digest = `sha256:${createHash('sha256').update(body).digest('hex')}`;
      const layer = {
        mediaType: 'application/vnd.docker.compose.file+yaml',
        size: scenario === 'invalid size' ? 6 * 1024 * 1024 : body.length + (scenario === 'wrong size' ? 1 : 0),
        digest: scenario === 'wrong digest' ? `sha256:${'0'.repeat(64)}` : digest,
      };
      server = createServer((request, response) => {
        if (request.url?.includes('/manifests/')) {
          response.setHeader('content-type', 'application/vnd.oci.image.manifest.v1+json');
          response.end(JSON.stringify({ schemaVersion: 2, layers: scenario === 'missing layer' ? [] : [layer] }));
        } else {
          response.setHeader('content-type', 'application/octet-stream');
          response.end(body);
        }
      });
      await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Missing test registry address');
      directory = await mkdtemp(join(tmpdir(), 'workbench-oci-test-'));
      const destinationPath = join(directory, 'compose.yml');
      await writeFile(destinationPath, 'previous');
      await expect(fetchComposeArtifact({
        registry: `127.0.0.1:${address.port}/team`, tag: 'latest', destinationPath,
      })).rejects.toThrow();
      expect(await readFile(destinationPath, 'utf8')).toBe('previous');
    },
  );
});
