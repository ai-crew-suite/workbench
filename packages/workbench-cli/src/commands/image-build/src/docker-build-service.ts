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
import chalk from 'chalk';
import { resolveRegistryAuth } from '../../../utils/docker-auth';

export interface BuildEngineOptions {
  t: string; // Image tag
  dockerfile: string;
  labels: Record<string, string>;
}

export class DockerBuildService {
  private docker: Docker;

  constructor(dockerInstance?: Docker) {
    this.docker = dockerInstance || new Docker();
  }

  /**
   * Compiles a container image over native Unix sockets using a contextual tar payload stream
   */
  async build(contextTarStream: NodeJS.ReadableStream, options: BuildEngineOptions): Promise<void> {
    const { t, dockerfile, labels } = options;

    // Forward Docker Hub credentials (docker CLI config or DOCKER_HUB_* overrides)
    // as the daemon auth header so base-image pulls authenticate under the account's
    // dedicated quota instead of shared anonymous per-IP limits.
    const authconfig = resolveRegistryAuth('docker.io');

    // Explicitly cast to ReadableStream to satisfy followProgress type constraints
    const outputStream = (await this.docker.buildImage(contextTarStream, {
      t,
      dockerfile,
      labels,
      ...(authconfig ? { authconfig } : {}),
    })) as unknown as NodeJS.ReadableStream;

    // Mirror progress stream messages to preserve high-fidelity console tracking logs
    await new Promise<void>((resolve, reject) => {
      this.docker.modem.followProgress(
        outputStream,
        (err, _) => (err ? reject(err) : resolve()),
        (event: any) => {
          if (event.errorDetail || event.error) {
            // Surface error frames as declarative build failures instead of
            // mirroring them to stderr and reporting a false success
            const message = event.errorDetail?.message ?? event.error;

            process.stderr.write(chalk.red(String(message)));

            reject(new Error(`Docker build stream failed: ${message}`));
          } else if (event.stream) {
            process.stdout.write(event.stream);
          }
        }
      );
    });
  }

  /**
   * Cleans hanging untagged intermediate layer blobs directly over engine sockets
   */
  async pruneImages(): Promise<void> {
    await this.docker.pruneImages({ filters: JSON.stringify({ dangling: ['true'] }) });
  }

  /** Inspects a built image and assigns its content-derived local tag. */
  async identifyImage(temporaryTag: string, target: string): Promise<{ imageId: string; localTag: string; platform: string }> {
    const image = this.docker.getImage(temporaryTag);
    const inspection = await image.inspect();
    if (!/^sha256:[a-f0-9]{64}$/.test(inspection.Id) || !inspection.Os || !inspection.Architecture) {
      throw new Error(`Docker returned an invalid image identity for ${temporaryTag}.`);
    }
    const tag = `sha256-${inspection.Id.slice(7)}`;
    await this.docker.getImage(inspection.Id).tag({ repo: `local/${target}`, tag });
    await image.remove();
    return {
      imageId: inspection.Id,
      localTag: `local/${target}:${tag}`,
      platform: `${inspection.Os}/${inspection.Architecture}${inspection.Variant ? `/${inspection.Variant}` : ''}`,
    };
  }
}
