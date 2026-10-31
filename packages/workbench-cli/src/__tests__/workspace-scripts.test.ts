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
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findRepoRoot } from '../utils/workspace';

const root = findRepoRoot();
const workspaces = [
  'app',
  'backend',
  'backstage/app',
  'backstage/backend',
  'fixtures/annotations',
  'fixtures/catalog',
  'fixtures/external',
  'fixtures/kubernetes',
  'fixtures/scaffolder',
  'fixtures/techdocs',
  'workbench-cli',
];
const commands = ['format', 'lint', 'test:e2e', 'test:unit', 'test:unit:coverage', 'typecheck'];

describe('workspace Crew scripts', () => {
  it.each(workspaces)('uses the root Crew module from packages/%s', workspace => {
    const manifest = JSON.parse(readFileSync(join(root, 'packages', workspace, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const scripts = commands.filter(command => command in manifest.scripts);
    expect(scripts.length).toBeGreaterThan(0);
    for (const command of scripts) {
      expect(manifest.scripts[command]).toBe(`backstage-cli crew ${command}`);
    }
    expect(manifest.devDependencies['@backstage/cli']).toBe('backstage:^');
    expect(manifest.dependencies?.['@ai-crew-suite/crew-cli']).toBeUndefined();
    expect(manifest.devDependencies['@ai-crew-suite/crew-cli']).toBeUndefined();
    expect(manifest.devDependencies['@ai-crew-suite/workbench-cli']).toBeUndefined();
  });
});
