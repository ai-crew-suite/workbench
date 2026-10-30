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
import { createClient } from '@snyk/docker-registry-v2-client';

export interface OciFetchOptions {
  registryUrl: string;
  artifactTag: string;
  destinationPath: string;
}

/**
 * Establishes an unauthenticated or token-injected channel to the target OCI registry,
 * pulls the target layout layer, and writes it directly to the local disk.
 */
export async function fetchComposeArtifact(options: OciFetchOptions): Promise<void>;

/*
1. Layer Compression: When tools like the oras CLI push a plain text file, they can either push it as a raw, uncompressed application/vnd.oci.image.layer.v1.tar or compressed as .tar+gzip. If it was pushed with compression, fileBuffer.toString('utf-8') will look like gibberish. You may need to pipe the buffer through a library like zlib / tar-stream to unzip it if it wasn't pushed as a raw binary blob.

2. Authentication Differences:
	• GHCR: Requires a GitHub Personal Access Token (PAT) with read:packages permissions.
	• Zot: Depending on your setup, it might use standard Basic Auth, Bearer tokens, or be entirely public (which means you can omit the username and password properties).
*/

async function downloadComposeFile() {
  // 1. Initialize the client for either GHCR or Zot
  // For GHCR: baseUrl is 'https://ghcr.io'
  // For Zot: baseUrl is 'https://your-zot-domain.com'
  const client = createClient({
    baseUrl: 'https://ghcr.io',
    username: 'your-username',
    password: 'your-personal-access-token-or-password',
  });

  const repository = 'my-org/my-compose-artifact';
  const reference = 'v1.0.0';

  // 2. Fetch the OCI Manifest
  // We specify the official OCI Manifest media type so the registry handles it correctly
  const manifest = await client.getManifest({
    name: repository,
    reference: reference,
    acceptManifest: 'application/vnd.oci.image.manifest.v1+json',
  });

  // 3. Extract the layer digest
  // Custom OCI artifacts usually wrap the text file in the first layer
  const textLayerDigest = manifest.layers[0].digest;

  // 4. Download the layer blob as text
  // We use `getLayer` (which buffers into memory) instead of `downloadLayer` (which streams to disk)
  const fileBuffer = await client.getLayer({
    name: repository,
    digest: textLayerDigest,
    acceptLayer: 'application/vnd.oci.image.layer.v1.tar+gzip, application/octet-stream',
  });

  const composeFileText = fileBuffer.toString('utf-8');
  console.log('Your Docker Compose File:', composeFileText);
}
