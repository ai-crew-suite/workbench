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

export interface BuildEngineOptions {
  t: string;
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

    // Explicitly cast to ReadableStream to satisfy followProgress type constraints
    const outputStream = (await this.docker.buildImage(contextTarStream, {
      t,
      dockerfile,
      labels,
    })) as unknown as NodeJS.ReadableStream;

    // Mirror progress stream messages to preserve high-fidelity console tracking logs
    await new Promise<void>((resolve, reject) => {
      this.docker.modem.followProgress(
        outputStream,
        (err, res) => (err ? reject(err) : resolve()),
        (event: any) => {
          if (event.stream) {
            process.stdout.write(event.stream);
          } else if (event.error) {
            process.stderr.write(chalk.red(event.error));
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

  /**
   * Pushes the compiled image to a remote registry context if execution occurs inside CI boundaries
   */
  async pushImage(imageTag: string): Promise<void> {
    const image = this.docker.getImage(imageTag);
    const stream = (await image.push({})) as unknown as NodeJS.ReadableStream;
    await new Promise<void>((resolve, reject) => {
      this.docker.modem.followProgress(stream, (err, res) => (err ? reject(err) : resolve()));
    });
  }
}
