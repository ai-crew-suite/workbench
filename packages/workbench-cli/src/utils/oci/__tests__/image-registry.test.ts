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
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageRegistry } from '../image-registry';

describe('OCI image registry', () => {
  const imageId = `sha256:${'a'.repeat(64)}`;
  const digest = `sha256:${'b'.repeat(64)}`;
  const reference = `localhost:32443/team/example@${digest}`;
  const execute = vi.fn();
  beforeEach(() => vi.resetAllMocks());

  it('uses plain HTTP for loopback and reads the manifest descriptor', async () => {
    execute.mockResolvedValue({ error: null, stdout: JSON.stringify({ digest }), stderr: '' });
    expect(await new ImageRegistry('localhost:32443/team', false, execute).digest(reference)).toBe(digest);
    expect(execute).toHaveBeenCalledWith(['manifest', 'fetch', '--descriptor', reference, '--plain-http']);
  });

  it('treats a missing manifest as absent without hiding registry errors', async () => {
    execute.mockResolvedValueOnce({ error: new Error('failed'), stderr: 'Error response from registry: example: not found', stdout: '' })
      .mockResolvedValueOnce({ error: new Error('failed'), stderr: 'authentication failed', stdout: '' });
    const registry = new ImageRegistry('localhost:32443/team', false, execute);
    expect(await registry.digest(reference, true)).toBeUndefined();
    await expect(registry.digest(reference, true)).rejects.toThrow('authentication failed');
  });

  it('reads and validates the registry image configuration digest', async () => {
    execute.mockResolvedValueOnce({ error: null, stdout: JSON.stringify({ config: { digest: imageId } }), stderr: '' })
      .mockResolvedValueOnce({ error: null, stdout: '{"config":{}}', stderr: '' });
    const registry = new ImageRegistry('localhost:32443/team', false, execute);
    expect(await registry.imageConfigDigest(reference)).toBe(imageId);
    await expect(registry.imageConfigDigest(reference)).rejects.toThrow('valid image config digest');
  });

  it('tags a digest directly without selecting a platform', async () => {
    execute.mockResolvedValue({ error: null, stdout: '', stderr: '' });
    await new ImageRegistry('localhost:32443/team', false, execute).promote(reference, 'latest');
    expect(execute).toHaveBeenCalledWith(['tag', reference, 'latest', '--plain-http']);
  });
});
