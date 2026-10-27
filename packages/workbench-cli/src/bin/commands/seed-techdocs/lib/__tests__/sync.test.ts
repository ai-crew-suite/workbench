/*
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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findPackages, parseCommentedJson, syncProjectReferences, type TsConfig } from '../sync';

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

describe('parseCommentedJson', () => {
  it('strips block and line comments and trailing commas', () => {
    const input = `{
      /* block comment */
      "extends": "../../tsconfig.base.json", // line comment
      "references": [],
    }`;

    expect(parseCommentedJson(input)).toEqual({
      extends: '../../tsconfig.base.json',
      references: [],
    });
  });
});

describe('findPackages', () => {
  let repoRoot: string;

  afterEach(() => {
    if (repoRoot) {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('registers leaf packages and stops recursing once package.json is found', () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'crew-sync-find-'));
    const pluginDir = join(repoRoot, 'plugins/kernel/node');
    mkdirSync(join(pluginDir, 'src'), { recursive: true });
    writeJson(join(pluginDir, 'package.json'), { name: '@test/plugin-node' });
    writeJson(join(pluginDir, 'src/package.json'), { name: '@test/should-not-be-found' });

    const result = findPackages(join(repoRoot, 'plugins'), repoRoot);

    expect(result.size).toBe(1);
    expect(result.get('@test/plugin-node')?.relativeFromRoot).toBe('plugins/kernel/node');
    expect(result.has('@test/should-not-be-found')).toBe(false);
  });

  it('ignores node_modules, dist, and dotfile directories', () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'crew-sync-find-'));
    mkdirSync(join(repoRoot, 'packages/app/node_modules/some-dep'), { recursive: true });
    writeJson(join(repoRoot, 'packages/app/node_modules/some-dep/package.json'), { name: 'some-dep' });
    mkdirSync(join(repoRoot, 'packages/app/dist'), { recursive: true });
    writeJson(join(repoRoot, 'packages/app/dist/package.json'), { name: '@test/should-not-be-found' });
    mkdirSync(join(repoRoot, 'packages/.hidden'), { recursive: true });
    writeJson(join(repoRoot, 'packages/.hidden/package.json'), { name: '@test/also-not-found' });
    writeJson(join(repoRoot, 'packages/app/package.json'), { name: '@test/app' });

    const result = findPackages(join(repoRoot, 'packages'), repoRoot);

    expect(Array.from(result.keys())).toEqual(['@test/app']);
  });

  it('returns an empty map for a directory that does not exist', () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'crew-sync-find-'));

    expect(findPackages(join(repoRoot, 'plugins'), repoRoot).size).toBe(0);
  });
});

describe('syncProjectReferences', () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'crew-sync-refs-'));
    writeFileSync(join(repoRoot, 'backstage.json'), '{}', 'utf8');
    writeJson(join(repoRoot, 'package.json'), { name: '@test/root' });
    vi.spyOn(process, 'cwd').mockReturnValue(repoRoot);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  function readTsConfig(relativePath: string): TsConfig {
    return JSON.parse(readFileSync(join(repoRoot, relativePath), 'utf8')) as TsConfig;
  }

  it('derives references from internal package dependencies across packages/ and plugins/', () => {
    mkdirSync(join(repoRoot, 'packages/app'), { recursive: true });
    writeJson(join(repoRoot, 'packages/app/package.json'), {
      name: '@test/app',
      dependencies: { '@test/plugin-node': '^0.0.1' },
    });
    writeJson(join(repoRoot, 'packages/app/tsconfig.json'), { extends: '../../tsconfig.base.json' });

    mkdirSync(join(repoRoot, 'plugins/kernel/node'), { recursive: true });
    writeJson(join(repoRoot, 'plugins/kernel/node/package.json'), { name: '@test/plugin-node' });
    writeJson(join(repoRoot, 'plugins/kernel/node/tsconfig.json'), {
      extends: '../../../tsconfig.base.json',
      compilerOptions: { outDir: '../../../dist-types/plugins/kernel/node' },
    });

    mkdirSync(join(repoRoot, 'plugins/kernel/backend'), { recursive: true });
    writeJson(join(repoRoot, 'plugins/kernel/backend/package.json'), {
      name: '@test/plugin-backend',
      dependencies: { '@test/plugin-node': '^0.0.1' },
    });
    writeJson(join(repoRoot, 'plugins/kernel/backend/tsconfig.json'), { extends: '../../../tsconfig.base.json' });

    writeJson(join(repoRoot, 'tsconfig.json'), { extends: './tsconfig.base.json' });

    syncProjectReferences();

    expect(readTsConfig('packages/app/tsconfig.json').references).toEqual([
      { path: '../../plugins/kernel/node' },
    ]);
    expect(readTsConfig('plugins/kernel/backend/tsconfig.json').references).toEqual([{ path: '../node' }]);

    const nodeTsConfig = readTsConfig('plugins/kernel/node/tsconfig.json');
    expect(nodeTsConfig.references).toBeUndefined();
    expect((nodeTsConfig['compilerOptions'] as { outDir?: string })?.outDir).toBe(
      '../../../dist-types/plugins/kernel/node',
    );

    const rootTsConfig = readTsConfig('tsconfig.json');
    expect(rootTsConfig.references).toEqual([
      { path: './packages/app' },
      { path: './plugins/kernel/backend' },
      { path: './plugins/kernel/node' },
    ]);
  });

  it('ignores a top-level apps/ directory', () => {
    mkdirSync(join(repoRoot, 'apps/legacy'), { recursive: true });
    writeJson(join(repoRoot, 'apps/legacy/package.json'), { name: '@test/legacy-app' });
    writeJson(join(repoRoot, 'tsconfig.json'), {});

    syncProjectReferences();

    const rootTsConfig = readTsConfig('tsconfig.json');
    expect(rootTsConfig.references).toEqual([]);
  });

  it('excludes devDependencies-only tooling packages from references', () => {
    mkdirSync(join(repoRoot, 'packages/app'), { recursive: true });
    writeJson(join(repoRoot, 'packages/app/package.json'), {
      name: '@test/app',
      devDependencies: { '@test/crew-cli': '^0.0.1' },
    });
    writeJson(join(repoRoot, 'packages/app/tsconfig.json'), {});

    mkdirSync(join(repoRoot, 'packages/crew-cli'), { recursive: true });
    writeJson(join(repoRoot, 'packages/crew-cli/package.json'), { name: '@test/crew-cli' });

    writeJson(join(repoRoot, 'tsconfig.json'), {});

    syncProjectReferences();

    expect(readTsConfig('packages/app/tsconfig.json').references).toBeUndefined();
  });

  it('should catch malformed json configurations gracefully without breaking execution logs', () => {
    mkdirSync(join(repoRoot, 'packages/app'), { recursive: true });
    writeJson(join(repoRoot, 'packages/app/package.json'), {
      name: '@test/app',
      dependencies: { '@test/plugin-node': '^0.0.1' },
    });

    writeFileSync(join(repoRoot, 'packages/app/tsconfig.json'), '{ "broken": [,,] }', 'utf8');

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { /* no-op */ });

    expect(() => syncProjectReferences()).not.toThrow();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error writing tsconfig for packages/app'),
      expect.any(String)
    );
  });

  it('should bypass leaf directories safely if a valid tsconfig.json file is absent', () => {
    mkdirSync(join(repoRoot, 'packages/pure-javascript-addon'), { recursive: true });
    writeJson(join(repoRoot, 'packages/pure-javascript-addon/package.json'), {
      name: '@test/js-addon',
    });

    expect(() => syncProjectReferences()).not.toThrow();
  });

  it('should enforce strict alphabetical ordering on output references to guarantee deterministic builds', () => {
    mkdirSync(join(repoRoot, 'packages/app'), { recursive: true });
    writeJson(join(repoRoot, 'packages/app/package.json'), {
      name: '@test/app',
      // Declare dependencies in reverse or unsorted entry order
      dependencies: { 
        '@test/z-plugin': '^1.0.0',
        '@test/a-plugin': '^1.0.0',
        '@test/m-plugin': '^1.0.0'
      },
    });
    writeJson(join(repoRoot, 'packages/app/tsconfig.json'), {});

    mkdirSync(join(repoRoot, 'plugins/z-plugin'), { recursive: true });
    writeJson(join(repoRoot, 'plugins/z-plugin/package.json'), { name: '@test/z-plugin' });
    mkdirSync(join(repoRoot, 'plugins/a-plugin'), { recursive: true });
    writeJson(join(repoRoot, 'plugins/a-plugin/package.json'), { name: '@test/a-plugin' });
    mkdirSync(join(repoRoot, 'plugins/m-plugin'), { recursive: true });
    writeJson(join(repoRoot, 'plugins/m-plugin/package.json'), { name: '@test/m-plugin' });

    writeJson(join(repoRoot, 'tsconfig.json'), {});

    syncProjectReferences();

    // Assert the output is fully sorted alphabetically regardless of package.json order
    expect(readTsConfig('packages/app/tsconfig.json').references).toEqual([
      { path: '../../plugins/a-plugin' },
      { path: '../../plugins/m-plugin' },
      { path: '../../plugins/z-plugin' },
    ]);
  });

  it('should preserve surrounding config parameters when healing a tsconfig path matrix', () => {
    mkdirSync(join(repoRoot, 'packages/app'), { recursive: true });
    writeJson(join(repoRoot, 'packages/app/package.json'), {
      name: '@test/app',
      dependencies: { '@test/plugin-node': '^0.0.1' },
    });

    writeJson(join(repoRoot, 'packages/app/tsconfig.json'), {
      compilerOptions: { strict: true, target: 'es2022' },
      include: ['src/*.ts']
    });

    mkdirSync(join(repoRoot, 'plugins/kernel/node'), { recursive: true });
    writeJson(join(repoRoot, 'plugins/kernel/node/package.json'), { name: '@test/plugin-node' });

    writeJson(join(repoRoot, 'tsconfig.json'), {});

    syncProjectReferences();

    const output = readTsConfig('packages/app/tsconfig.json');

    // Core check: References are injected, but surrounding custom setup arrays remain unaltered
    expect(output.references).toEqual([{ path: '../../plugins/kernel/node' }]);
    expect(output['include']).toEqual(['src/*.ts']);
    expect(output['compilerOptions']).toEqual({ strict: true, target: 'es2022' });
  });
});
