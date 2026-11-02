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
import { spawnSync } from 'child_process';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

const script = path.resolve(__dirname, '../build-techdocs.sh');
const workspaces: string[] = [];

function createWorkspace() {
  const workspace = mkdtempSync(path.join(tmpdir(), 'techdocs-test-'));
  workspaces.push(workspace);
  const bin = path.join(workspace, 'bin');
  const source = path.join(workspace, 'markdown');
  const output = path.join(workspace, 'static-compiled/default/component/platform');
  mkdirSync(bin);
  mkdirSync(source);
  mkdirSync(output, { recursive: true });
  writeFileSync(path.join(source, 'mkdocs.yml'), 'original');
  writeFileSync(path.join(output, 'index.html'), 'previous');
  writeFileSync(
    path.join(bin, 'npx'),
    `#!/usr/bin/env bash
set -e
echo changed > "$TECHDOCS_CONTAINER_SOURCE/mkdocs.yml"
mkdocs build -f mkdocs.yml -d "$TECHDOCS_CONTAINER_OUTPUT" -v
echo generated > "$TECHDOCS_CONTAINER_OUTPUT/index.html"
`,
  );
  writeFileSync(
    path.join(bin, 'docker'),
    `#!/usr/bin/env bash
set -e
if [ "$1" = info ]; then
  echo "$TEST_SECURITY_OPTIONS"
else
  printf '%s\\n' "$@" > "$TEST_DOCKER_ARGS"
  if [ "\${TEST_DOCKER_FAIL:-}" = yes ]; then
    echo 'simulated container failure' >&2
    exit 42
  fi
fi
`,
  );
  chmodSync(path.join(bin, 'npx'), 0o755);
  chmodSync(path.join(bin, 'docker'), 0o755);
  return { workspace, bin, source, output };
}

afterEach(() => {
  for (const workspace of workspaces.splice(0)) {
    rmSync(workspace, { recursive: true, force: true });
  }
});

describe('TechDocs compilation', () => {
  it.each([
    ['rootless', '["name=rootless"]', false],
    ['rootful', '["name=seccomp"]', true],
  ])('generates with the correct user for %s containers', (_name, securityOptions, usesUser) => {
    const { workspace, bin, source, output } = createWorkspace();
    const argsFile = path.join(workspace, 'docker-args');
    const result = spawnSync('bash', [script], {
      cwd: workspace,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        TEST_SECURITY_OPTIONS: securityOptions,
        TEST_DOCKER_ARGS: argsFile,
      },
    });

    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(path.join(output, 'index.html'), 'utf8')).toBe('generated\n');
    expect(readFileSync(path.join(source, 'mkdocs.yml'), 'utf8')).toBe('original');
    const args = readFileSync(argsFile, 'utf8').split('\n');
    expect(args.includes('--user')).toBe(usesUser);
    expect(args).toContain('--rm');
    expect(readdirSync(path.dirname(output))).toEqual(['platform']);
  });

  it('surfaces container failure, preserves previous output, and cleans temporary files', () => {
    const { workspace, bin, output } = createWorkspace();
    const result = spawnSync('bash', [script], {
      cwd: workspace,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        TEST_SECURITY_OPTIONS: '["name=rootless"]',
        TEST_DOCKER_ARGS: path.join(workspace, 'docker-args'),
        TEST_DOCKER_FAIL: 'yes',
      },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('simulated container failure');
    expect(readFileSync(path.join(output, 'index.html'), 'utf8')).toBe('previous');
    expect(readdirSync(path.dirname(output))).toEqual(['platform']);
  });

  it('restores previous output when installing the new site fails', () => {
    const { workspace, bin, output } = createWorkspace();
    const fakeMove = path.join(bin, 'mv');
    writeFileSync(
      fakeMove,
      `#!/usr/bin/env bash
if [[ "$1" == */output ]]; then
  echo 'simulated installation failure' >&2
  exit 1
fi
exec /bin/mv "$@"
`,
    );
    chmodSync(fakeMove, 0o755);
    const result = spawnSync('bash', [script], {
      cwd: workspace,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        TEST_SECURITY_OPTIONS: '["name=rootless"]',
        TEST_DOCKER_ARGS: path.join(workspace, 'docker-args'),
      },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('simulated installation failure');
    expect(readFileSync(path.join(output, 'index.html'), 'utf8')).toBe('previous');
    expect(readdirSync(path.dirname(output))).toEqual(['platform']);
  });
});
