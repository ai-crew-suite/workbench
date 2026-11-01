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
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { findRepoRoot } from '../../../utils/workspace';
import { ComposeClusterController } from '../../compose-start/src/cluster';
import { inspectExistingStacks, withLegacyStackLock } from '../../compose-start/src/legacy';
import { LifecycleStore } from '../../compose-start/src/state';

/** Stops the user's shared Compose stack without managing dev servers. */
export async function stopCompose(): Promise<void> {
  const root = findRepoRoot();

  if (!existsSync(join(root, 'backstage.json'))) {
    throw new Error('Run this command inside a Backstage repository containing backstage.json.');
  }

  const store = await LifecycleStore.create(root);

  await store.locked(async () => {
    const state = await store.read();
    const { legacy, sharedExists, daemonId } = await inspectExistingStacks(store);

    if (state && state.daemonId !== daemonId) {
      throw new Error(
        'The workbench stack belongs to a different Docker daemon; switch back to that daemon before stopping it.'
      );
    }

    if (!state && sharedExists) {
      throw new Error(
        `Workbench project ${store.projectName} exists without its state file; stop it manually before continuing.`
      );
    }

    if ((state ? 1 : 0) + legacy.length > 1) {
      throw new Error(
        'Multiple workbench stacks were found. Stop the previous repository-scoped projects individually before continuing.'
      );
    }

    if (!state && legacy.length === 0) {
      console.log('No managed Compose stack is recorded.');

      return;
    }

    if (!state) {
      const previous = legacy[0]!;

      console.log(`Stopping the previous workbench stack from ${previous.repository} (${previous.root}).`);

      await withLegacyStackLock(previous, async () => {
        const current = await inspectExistingStacks(store);

        if (current.daemonId !== daemonId || current.sharedExists || current.legacy.length !== 1
          || current.legacy[0]?.stateFile !== previous.stateFile
          || current.legacy[0]?.root !== previous.root) {
          throw new Error('Previous workbench stack state changed during teardown; retry the command.');
        }

        await new ComposeClusterController({
          composeFile: previous.composeFile, projectDirectory: previous.root, projectName: previous.projectName,
        }).down();

        await rm(previous.stateFile);
      });

      return;
    }

    state.phase = 'stopping';

    await store.write(state);

    await new ComposeClusterController({
      composeFile: state.composeFile, projectDirectory: state.root, projectName: state.projectName,
    }).down();

    await store.clear();
  });
}
