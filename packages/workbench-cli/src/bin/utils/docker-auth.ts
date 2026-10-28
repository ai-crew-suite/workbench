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
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Registry authentication payload serialized into the daemon `X-Registry-Auth`
 * header so base-image pulls and distribution pushes run under the account's
 * dedicated quota instead of shared anonymous per-IP limits.
 */
export interface RegistryAuthConfig {
  /** Registry account or service identity name */
  username: string;
  /** Account password or personal access token */
  password: string;
  /** Canonical registry endpoint the credentials belong to */
  serveraddress: string;
  /** Bearer identity token preferred over password-based credentials when present */
  identitytoken?: string;
}

/** Canonical API endpoint for the Docker Hub registry */
const DOCKER_HUB_SERVER_ADDRESS = 'https://index.docker.io/v1/';

/**
 * Host aliases that all resolve to the Docker Hub registry. Docker daemon
 * configurations historically address it through any of these endpoints.
 */
const DOCKER_HUB_ALIASES = new Set([
  'docker.io',
  'index.docker.io',
  'index.docker.com',
  'registry.hub.docker.com',
  'registry-1.docker.io',
]);

/** Shape of an `auths` entry inside a docker CLI configuration file */
interface DockerConfigAuthEntry {
  auth?: string;
  identitytoken?: string;
  username?: string;
  email?: string;
}

/** Minimal subset of the docker CLI configuration file consumed here */
interface DockerConfig {
  auths?: Record<string, DockerConfigAuthEntry>;
}

/**
 * Normalizes a configuration auths key such as `https://index.docker.io/v1/`
 * down to its bare lowercase host segment `index.docker.io`.
 */
function normalizeRegistryHost(entryKey: string): string {
  return entryKey.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '').split('/')[0]!.toLowerCase();
}

/**
 * Decodes a base64 `username:password` pair stored in a docker config auths entry.
 */
function decodeBasicAuth(auth: string): { username: string; password: string } | undefined {
  const decoded = Buffer.from(auth, 'base64').toString('utf8');
  const separator = decoded.indexOf(':');
  if (separator === -1) return undefined;
  return {
    username: decoded.slice(0, separator),
    password: decoded.slice(separator + 1),
  };
}

/**
 * Extracts the registry host segment from a fully-qualified image reference.
 * Unqualified references (no dot or port in the first path segment) resolve to
 * the Docker Hub registry, mirroring standard image-name resolution rules.
 */
export function registryHostFromImageReference(reference: string): string {
  const firstSegment = reference.split('/')[0]!;
  if (!firstSegment.includes('.') && !firstSegment.includes(':')) {
    return 'docker.io';
  }
  return firstSegment.toLowerCase();
}

/**
 * Resolves registry credentials for a target registry host.
 *
 * Resolution order:
 * 1. `DOCKER_HUB_USERNAME` / `DOCKER_HUB_TOKEN` environment overrides for Docker Hub hosts
 * 2. The docker CLI configuration (`~/.docker/config.json`) `auths` entries —
 *    written by `docker login` and `docker/login-action` — matching the host
 *    directly or through any Docker Hub alias
 *
 * Returns undefined when no credentials are configured; callers then omit the
 * auth header entirely, which keeps anonymous local registries (Zot) working.
 */
export function resolveRegistryAuth(
  registryHost: string,
  configPath: string = join(homedir(), '.docker', 'config.json'),
): RegistryAuthConfig | undefined {
  const host = registryHost.toLowerCase();
  const isDockerHub = DOCKER_HUB_ALIASES.has(host);

  const envUsername = process.env['DOCKER_HUB_USERNAME'];
  const envToken = process.env['DOCKER_HUB_TOKEN'] ?? process.env['DOCKER_HUB_PASSWORD'];
  if (isDockerHub && envUsername && envToken) {
    return { username: envUsername, password: envToken, serveraddress: DOCKER_HUB_SERVER_ADDRESS };
  }

  let config: DockerConfig | undefined;
  try {
    config = JSON.parse(readFileSync(configPath, 'utf8')) as DockerConfig;
  } catch {
    return undefined;
  }

  for (const [entryKey, entry] of Object.entries(config.auths ?? {})) {
    const entryHost = normalizeRegistryHost(entryKey);
    const hostMatches = isDockerHub ? DOCKER_HUB_ALIASES.has(entryHost) : entryHost === host;
    if (!hostMatches) continue;

    if (entry.identitytoken) {
      return {
        username: entry.username ?? '',
        password: '',
        identitytoken: entry.identitytoken,
        serveraddress: `https://${entryHost}`,
      };
    }

    if (entry.auth) {
      const basic = decodeBasicAuth(entry.auth);
      if (basic) {
        return {
          ...basic,
          serveraddress: isDockerHub ? DOCKER_HUB_SERVER_ADDRESS : `https://${entryHost}`,
        };
      }
    }
  }

  return undefined;
}