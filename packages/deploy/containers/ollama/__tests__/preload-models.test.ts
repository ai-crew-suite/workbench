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
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('../src/preload-models.sh', import.meta.url));
const tempDirs: string[] = [];

const stub = `#!/usr/bin/env bash
set -eu
echo "$1 \${2:-} $OLLAMA_HOST" >> "$TEST_LOG"
case "$1" in
  serve)
    if [[ "\${TEST_CASE:-}" == server-fails ]]; then
      echo "fake server failed" >&2
      exit 1
    fi
    exec sleep 300
    ;;
  list)
    if [[ "\${TEST_CASE:-}" == server-fails ]]; then exit 1; fi
    ;;
  pull)
    if [[ "\${TEST_CASE:-}" == pull-fails ]]; then exit 1; fi
    if [[ "\${TEST_CASE:-}" != missing-manifest ]]; then
      model="\${2%:*}"
      tag="\${2##*:}"
      manifest_dir=manifests-v2
      if [[ "\${TEST_CASE:-}" == legacy-manifest ]]; then manifest_dir=manifests; fi
      mkdir -p "$OLLAMA_MODELS/$manifest_dir/registry.ollama.ai/library/$model"
      echo manifest > "$OLLAMA_MODELS/$manifest_dir/registry.ollama.ai/library/$model/$tag"
    fi
    ;;
  show) ;;
  *) exit 1 ;;
esac
`;

function runPreload(testCase = '') {
  const dir = mkdtempSync(path.join(tmpdir(), 'ollama-preload-test-'));
  tempDirs.push(dir);
  const bin = path.join(dir, 'bin');
  mkdirSync(bin);
  writeFileSync(path.join(bin, 'ollama'), stub, { mode: 0o755 });
  const log = path.join(dir, 'calls');
  const result = spawnSync('bash', [script], {
    encoding: 'utf8',
    timeout: 10_000,
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      OLLAMA_HOST: 'http://example.invalid:11434',
      OLLAMA_MODELS: path.join(dir, 'models'),
      TEST_LOG: log,
      TEST_CASE: testCase,
    },
  });
  return { result, calls: readFileSync(log, 'utf8') };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('Ollama build model preload', () => {
  it('pulls and verifies all models using the local build server', () => {
    const { result, calls } = runPreload();
    expect(result.status, result.stderr).toBe(0);
    for (const model of ['llama3.2:latest', 'bge-m3:latest', 'llama-guard3:1b']) {
      expect(calls).toContain(`pull ${model} 127.0.0.1:39431`);
      expect(calls).toContain(`show ${model} 127.0.0.1:39431`);
    }
  });

  it('fails when a pulled model is absent from the image filesystem', () => {
    const { result, calls } = runPreload('missing-manifest');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Model llama3.2:latest was not saved');
    expect(calls).not.toContain('pull bge-m3:latest');
  });

  it('accepts legacy manifests', () => {
    const { result } = runPreload('legacy-manifest');
    expect(result.status, result.stderr).toBe(0);
  });

  it('fails immediately when a pull fails', () => {
    const { result, calls } = runPreload('pull-fails');
    expect(result.status).not.toBe(0);
    expect(calls).not.toContain('pull bge-m3:latest');
  });

  it('reports the server log if the build server exits', () => {
    const { result } = runPreload('server-fails');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('fake server failed');
  });
});
