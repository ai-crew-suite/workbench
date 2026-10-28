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
import Docker from 'dockerode';

export class DockerService {
  private docker: Docker;

  constructor(dockerInstance?: Docker) {
    this.docker = dockerInstance || new Docker();
  }

  /**
   * Applies a remote tracking tag to a local engine image artifact.
   */
  async tagImage(source: string, target: string): Promise<void> {
    const image = this.docker.getImage(source);

    // Resolve type error by cleanly separating out our repo and tag components
    const lastColonIndex = target.lastIndexOf(':');
    if (lastColonIndex === -1) {
      throw new Error(`Invalid target image tag configuration provided: ${target}`);
    }

    const repo = target.substring(0, lastColonIndex);
    const tag = target.substring(lastColonIndex + 1);

    // Feeds verified string variables directly to meet strict overload signatures
    await image.tag({ repo, tag });
  }

  /**
   * Streams layer blobs to the target registry and returns the definitive RepoDigest.
   *
   * The digest is captured from the daemon's terminal push status frame ("latest:
   * digest: sha256:...") instead of `image.inspect().RepoDigests`, which can hold
   * stale digests from previous pushes of different image content.
   */
  async pushImage(targetTag: string): Promise<string> {
    const image = this.docker.getImage(targetTag);
    const stream = await image.push({});

    let remoteDigest: string | undefined;
    let streamError: string | undefined;

    await new Promise<void>((resolve, reject) => {
      this.docker.modem.followProgress(
        stream,
        (err, res) => (err ? reject(err) : resolve()),
        (event: any) => {
          if (event.errorDetail || event.error) {
            // Surface error frames that followProgress would otherwise swallow silently
            streamError = event.errorDetail?.message ?? event.error;
          } else if (typeof event.status === 'string') {
            const digestMatch = event.status.match(/digest: (sha256:[a-f0-9]+)/);
            if (digestMatch) {
              remoteDigest = digestMatch[1];
            }
          }
        }
      );
    });

    if (streamError) {
      throw new Error(`Remote registry push stream failed: ${streamError}`);
    }

    if (!remoteDigest) {
      throw new Error(`Failed to isolate a remote distribution digest for target package reference: ${targetTag}`);
    }

    // Isolate the base remote registry endpoint name before the tag colon as a guaranteed string
    const lastColonIndex = targetTag.lastIndexOf(':');
    const targetRepoBase = lastColonIndex !== -1 ? targetTag.substring(0, lastColonIndex) : targetTag;

    return `${targetRepoBase}@${remoteDigest}`;
  }
}
