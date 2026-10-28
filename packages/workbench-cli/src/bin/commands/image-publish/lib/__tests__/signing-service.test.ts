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
import { SigningService } from '../signing-service.js';
import sign from 'sigstore';
import fs from 'node:fs';

// Intercept sigstore binary calls out-of-band
vi.mock('sigstore', () => ({
  default: {
    sign: vi.fn().mockResolvedValue({}),
  },
  sign: vi.fn().mockResolvedValue({}),
}));

describe('SigningService Unit Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should run a keyless OIDC sign sequence when executing in CI contexts', async () => {
    const service = new SigningService();
    const digest = 'localhost:32443/ai-crew-suite/grafana@sha256:e743b0e413d4d59dba9d2bff26b65476306b875e93fe278a57f4a4377ff0a41a';

    await service.signDigest(digest, {
      isCI: true,
      keyPath: '/fake/root/cosign.key',
    });

    // Keyless triggers minimal sigstore parameters allowing ambient OIDC fulfillment
    expect(sign.sign).toHaveBeenCalledWith(Buffer.from(digest));
  });

  it('should run an offline local static key-pair sequence when on a local workstation', async () => {
    // Intercept fs calls to cleanly trick key validation checks
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const readSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue('-----BEGIN RSA PRIVATE KEY-----\nmock\n-----END RSA PRIVATE KEY-----');

    const service = new SigningService();
    const digest = 'localhost:32443/ai-crew-suite/grafana@sha256:e743b0e413d4d59dba9d2bff26b65476306b875e93fe278a57f4a4377ff0a41a';

    await service.signDigest(digest, {
      isCI: false,
      keyPath: '/fake/root/cosign.key',
      cosignPass: 'secure-workbench-password',
    });

    // Verifies it completely blanked out transparency log endpoints to force a local offline signing workflow
    expect(sign.sign).toHaveBeenCalledWith(
      Buffer.from(digest),
      expect.objectContaining({
        rekorURL: '',
        fulcioURL: '',
        identityToken: undefined,
      })
    );

    existsSpy.mockRestore();
    readSpy.mockRestore();
  });

  it('should throw an error if a local key-based profile runs without a keyfile on disk', async () => {
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const service = new SigningService();

    await expect(
      service.signDigest('localhost:32443/ai-crew-suite/grafana@sha256:123', {
        isCI: false,
        keyPath: '/non-existent/cosign.key',
      })
    ).rejects.toThrow('Local static keypair missing at path');

    existsSpy.mockRestore();
  });
});
