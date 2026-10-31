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
import { spawn } from 'node:child_process';

/** Compose paths and project identity for a single consuming repository. */
export interface ClusterOptions {
  composeFile: string;
  projectDirectory: string;
  projectName: string;
}

/** Controls the isolated Compose project without removing named volumes. */
export class ComposeClusterController {
  constructor(private readonly options: ClusterOptions) {}

  private async run(command: string[]): Promise<void> {
    const { composeFile, projectDirectory, projectName } = this.options;
    const args = ['compose', '--project-name', projectName, '--project-directory', projectDirectory, '-f', composeFile, ...command];
    const child = spawn('docker', args, { cwd: projectDirectory, stdio: 'inherit' });
    await new Promise<void>((resolve, reject) => {
      child.once('error', error => reject(new Error('Failed to launch Docker Compose.', { cause: error })));
      child.once('close', (code, signal) => {
        if (code === 0) resolve();
        else reject(new Error(`Docker Compose ${command[0]} failed${signal ? ` with signal ${signal}` : ` with status ${code}`}.`));
      });
    });
  }

  /** Starts or reconciles the stack and waits for health checks. */
  async up(): Promise<void> {
    await this.run(['up', '-d', '--wait']);
  }

  /** Stops the isolated project, retaining its named volumes. */
  async down(): Promise<void> {
    await this.run(['down']);
  }
}
