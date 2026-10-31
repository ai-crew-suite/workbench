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
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findRepoRoot } from '../utils/workspace';

const root = findRepoRoot();
const cli = path.join(root, 'node_modules/@backstage/cli/bin/backstage-cli');

function run(args: string[], cwd = root) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0' },
  });
}

describe('Backstage CLI module integration', () => {
  it('is discovered at the repository root and in a child workspace', () => {
    for (const cwd of [root, path.join(root, 'packages/deploy/compose')]) {
      const result = run(['workbench', '--help'], cwd);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('compose');
      expect(result.stdout).toContain('image');
      expect(result.stdout).toContain('wiremock');
    }
  });

  it.each([
    ['compose lint', ['compose', 'lint']],
    ['compose publish', ['compose', 'publish']],
    ['compose start', ['compose', 'start']],
    ['compose stop', ['compose', 'stop']],
    ['image build', ['image', 'build']],
    ['image lint', ['image', 'lint']],
    ['image publish', ['image', 'publish']],
    ['image test security', ['image', 'test', 'security']],
    ['image test structure', ['image', 'test', 'structure']],
    ['wiremock seeder', ['wiremock', 'seeder']],
  ])('loads %s help', (_name, command) => {
    const result = run(['workbench', ...command, '--help']);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('Usage: backstage-cli workbench');
  });

  it('propagates command failures to the CLI exit status', () => {
    const result = run(['workbench', 'compose', 'lint', '__missing_workbench_target__']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Target tracking location failure');
  });

  it('exposes the same commands through the standalone module binary', () => {
    const result = spawnSync(process.execPath, [
      path.join(root, 'packages/workbench-cli/bin/backstage-cli-module-workbench'),
      'workbench', 'image', 'lint', '--help',
    ], { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('workbench image lint');
  });
});
