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
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { getLayer, getManifest } from '@snyk/docker-registry-v2-client';
import { resolveRegistryAuth } from '../../../utils/docker-auth';
import { resolveTargetTags } from '../../../utils/oci';

const COMPOSE_MEDIA_TYPE = 'application/vnd.docker.compose.file+yaml';
const MAX_COMPOSE_BYTES = 5 * 1024 * 1024;

/** Registry and destination for a published Compose artifact. */
export interface OciFetchOptions {
  registry: string;
  tag: string;
  destinationPath: string;
  plainHttp?: boolean;
}

/** Selects HTTP for explicit insecure registries and IPv4 loopback hosts. */
export function registryTransport(registry: string, plainHttp?: boolean): 'http' | 'https' {
  const host = registry.split('/')[0] ?? '';
  return plainHttp || host === 'localhost' || host.startsWith('localhost:')
    || host === '127.0.0.1' || host.startsWith('127.0.0.1:') ? 'http' : 'https';
}

/**
 * Retrieves the Compose layer published by the workbench CLI and verifies its
 * digest before atomically replacing the cached manifest.
 */
export async function fetchComposeArtifact(options: OciFetchOptions): Promise<string> {
  const { registry, tag, destinationPath, plainHttp } = options;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.:-]*(?:\/[a-zA-Z0-9._-]+)+$/.test(registry)) {
    throw new Error('Registry must be a host and namespace without a URL scheme.');
  }
  if (!/^[\w][\w.-]{0,127}$/.test(tag)) {
    throw new Error('Invalid Compose artifact tag.');
  }

  const reference = resolveTargetTags('compose', registry, tag).remoteTargetTag;
  const [host] = registry.split('/');
  if (!host) throw new Error('Registry host is missing.');
  const repository = reference.slice(host.length + 1, -(tag.length + 1));
  const authPath = join(process.env['DOCKER_CONFIG'] || join(homedir(), '.docker'), 'config.json');
  const auth = resolveRegistryAuth(host, authPath);
  if (auth?.identitytoken) {
    throw new Error('Docker identity-token credentials are not supported for Compose retrieval; configure registry username and password credentials.');
  }
  const clientOptions = {
    protocol: `${registryTransport(registry, plainHttp)}:`,
    acceptManifest: 'application/vnd.oci.image.manifest.v1+json',
    acceptLayer: COMPOSE_MEDIA_TYPE,
    timeout: 30000,
  };
  const manifest = await getManifest(host, repository, tag, auth?.username, auth?.password, clientOptions);
  const layers = manifest.layers?.filter(layer => layer.mediaType === COMPOSE_MEDIA_TYPE) ?? [];
  if (layers.length !== 1) {
    throw new Error(`Expected exactly one Compose YAML layer in ${reference}.`);
  }
  const layer = layers[0]!;
  if (!Number.isSafeInteger(layer.size) || layer.size <= 0 || layer.size > MAX_COMPOSE_BYTES
    || !/^sha256:[a-f0-9]{64}$/.test(layer.digest)) {
    throw new Error('Compose layer has an invalid size or digest.');
  }

  const content = await getLayer(host, repository, layer.digest, auth?.username, auth?.password, clientOptions);
  const digest = `sha256:${createHash('sha256').update(content).digest('hex')}`;
  if (content.length !== layer.size || digest !== layer.digest) {
    throw new Error('Compose layer size or digest does not match the OCI manifest.');
  }

  await mkdir(dirname(destinationPath), { recursive: true, mode: 0o700 });
  const temporary = `${destinationPath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, content, { mode: 0o600, flag: 'wx' });
    await rename(temporary, destinationPath);
  } finally {
    await rm(temporary, { force: true });
  }
  return reference;
}
