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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { SigningService } from '../signing-service';

// Intercept native cosign invocations while preserving remaining child_process exports
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  const mockedSpawnSync = vi.fn().mockReturnValue({ status: 0 });
  return {
    ...actual,
    spawnSync: mockedSpawnSync,
    default: { ...actual, spawnSync: mockedSpawnSync }
  };
});

const imageDigest = 'localhost:32443/ai-crew-suite/grafana@sha256:e743b0e413d4d59dba9d2bff26b65476306b875e93fe278a57f4a4377ff0a41a';

describe('SigningService Unit Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('should run an offline local static key-pair sequence when on a local workstation', async () => {
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    const service = new SigningService();
    await service.signDigest(imageDigest, {
      isCI: false,
      keyPath: '/fake/root/cosign.key',
      cosignPass: 'secure-workbench-password',
    });

    expect(spawnSync).toHaveBeenCalledWith(
      'cosign',
      expect.arrayContaining([
        'sign',
        '--yes',
        '--key',
        '/fake/root/cosign.key',
        '--allow-http-registry=true',
        '--use-signing-config=false',
        '--tlog-upload=false',
        imageDigest,
      ]),
      expect.objectContaining({
        env: expect.objectContaining({ COSIGN_PASSWORD: 'secure-workbench-password' }),
      })
    );

    existsSpy.mockRestore();
  });

  it('should fall back to the COSIGN_PRIVATE_KEY env parameter when no key file exists', async () => {
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    vi.stubEnv('COSIGN_PRIVATE_KEY', '-----BEGIN ENCRYPTED COSIGN PRIVATE KEY-----mock');

    const service = new SigningService();
    await service.signDigest(imageDigest, {
      isCI: false,
      keyPath: '/fake/root/cosign.key',
      cosignPass: 'secure-workbench-password',
    });

    expect(spawnSync).toHaveBeenCalledWith(
      'cosign',
      expect.arrayContaining(['--key', 'env://COSIGN_PRIVATE_KEY']),
      expect.objectContaining({
        env: expect.objectContaining({ COSIGN_PASSWORD: 'secure-workbench-password' }),
      })
    );

    existsSpy.mockRestore();
  });

  it('should run a keyless OIDC sign sequence when executing in CI contexts', async () => {
    const service = new SigningService();

    await service.signDigest(imageDigest, {
      isCI: true,
      keyPath: '/fake/root/cosign.key',
    });

    // Keyless profile triggers minimal cosign parameters allowing ambient OIDC fulfillment
    expect(spawnSync).toHaveBeenCalledWith('cosign', ['sign', '--yes', imageDigest], {
      stdio: 'inherit',
      env: undefined,
    });
  });

  it('should throw an error if a local key-based profile runs without any key material', async () => {
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const service = new SigningService();
    await expect(
      service.signDigest(imageDigest, { isCI: false, keyPath: '/non-existent/cosign.key' })
    ).rejects.toThrow('No cosign private key found');

    existsSpy.mockRestore();
  });

  it('should throw an error if the cosign child process exits with a failure status', async () => {
    vi.mocked(spawnSync).mockReturnValueOnce({ status: 1 } as any);
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    const service = new SigningService();
    await expect(
      service.signDigest(imageDigest, {
        isCI: false,
        keyPath: '/fake/root/cosign.key',
        cosignPass: 'secure-workbench-password',
      })
    ).rejects.toThrow('Cosign signature pipeline exited with failure status code 1');

    existsSpy.mockRestore();
  });
});
