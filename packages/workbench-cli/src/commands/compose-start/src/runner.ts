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
import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { findRepoRoot } from '../../../utils/workspace';
import { resolveTargetTags } from '../../../utils/oci';
import { ComposeClusterController } from './cluster';
import { inspectExistingStacks } from './legacy';
import { fetchComposeArtifact, registryTransport } from './oci';
import { LifecycleStore } from './state';

/** Options for starting the shared Compose stack. */
export interface StartOptions {
  registry: string;
  tag: string;
  plainHttp?: boolean;
}

/** Starts or reconciles the user's shared stack without managing dev servers. */
export async function startCompose(options: StartOptions): Promise<void> {
  const root = findRepoRoot();
  if (!existsSync(join(root, 'backstage.json'))) {
    throw new Error('Run this command inside a Backstage repository containing backstage.json.');
  }
  const store = await LifecycleStore.create(root);
  const reference = resolveTargetTags('compose', options.registry, options.tag).remoteTargetTag;
  const transport = registryTransport(options.registry, options.plainHttp);

  await store.locked(async () => {
    const { legacy, sharedExists, daemonId } = await inspectExistingStacks(store);
    if (legacy.length) {
      throw new Error(`A previous workbench stack is already present (${legacy.map(item => `${item.repository} at ${item.root}`).join(', ')}). Run workbench compose stop before starting a new stack.`);
    }
    let state = await store.read();
    if (!state && sharedExists) {
      throw new Error(`Workbench project ${store.projectName} exists without its state file; stop it manually before continuing.`);
    }
    if (state && state.root !== store.root) {
      throw new Error(`The workbench stack is already running or reserved by ${state.repository} (${state.root}). Stop it before starting from ${basename(store.root)}.`);
    }
    if (state && state.daemonId !== daemonId) {
      throw new Error('The workbench stack belongs to a different Docker daemon; switch back to that daemon before starting or stopping it.');
    }
    if (state?.phase === 'stopping') throw new Error('Compose teardown is in progress; retry after it completes.');
    if (state && (state.reference !== reference || state.transport !== transport)) {
      throw new Error(`The active stack uses ${state.transport}://${state.reference}; stop it before changing the artifact or transport.`);
    }
    if (!state) {
      await fetchComposeArtifact({
        registry: options.registry, tag: options.tag, destinationPath: store.composeFile, plainHttp: options.plainHttp,
      });
      state = {
        version: 2, root: store.root, repository: basename(store.root), composeFile: store.composeFile,
        projectName: store.projectName, daemonId, reference, transport, phase: 'starting',
      };
      await store.write(state);
    } else {
      console.log(`Reconciling the workbench stack started from ${state.repository} (${state.root}).`);
    }
    const cluster = new ComposeClusterController({
      composeFile: state.composeFile, projectDirectory: state.root, projectName: state.projectName,
    });
    await cluster.up();
    state.phase = 'running';
    await store.write(state);
  });
}
