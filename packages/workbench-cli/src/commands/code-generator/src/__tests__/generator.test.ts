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
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findRepoRoot } from '../../../../utils/workspace';
import { generatePlugin, type TemplateRole } from '../generator';
import { registerRuntime } from '../registration';

let root: string;

async function write(path: string, value: string): Promise<void> {
  await mkdir(join(root, path, '..'), { recursive: true });
  await writeFile(join(root, path), value);
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'workbench-generator-test-'));
  await write('backstage.json', '{}');
  await write('package.json', JSON.stringify({ private: true, workspaces: ['packages/*'] }));
  await write('tsconfig.json', JSON.stringify({ references: [] }));
  await write('packages/app/package.json', JSON.stringify({ name: 'app', dependencies: {} }));
  await write('packages/backend/package.json', JSON.stringify({ name: 'backend', dependencies: {} }));
  await write('packages/app/src/App.tsx', "import { createApp } from '@backstage/frontend-defaults';\nconst app = createApp({ features: [] });\n");
  await write('packages/backend/src/index.ts', "import { createBackend } from '@backstage/backend-defaults';\nconst backend = createBackend();\nbackend.start();\n");
  const repo = findRepoRoot();
  await copyFile(join(repo, 'yarn.lock'), join(root, 'yarn.lock'));
  await copyFile(join(repo, '.yarnrc.yml'), join(root, '.yarnrc.yml'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('plugin generation', () => {
  it.each([
    ['frontend-plugin', 'example'],
    ['frontend-plugin-module', 'example-module-extra'],
    ['backend-plugin', 'example-backend'],
    ['backend-plugin-module', 'example-backend-module-extra'],
  ] satisfies Array<[TemplateRole, string]>)('generates and registers %s', async (type, name) => {
    const frontend = type.startsWith('frontend');
    const isModule = type.endsWith('-module');
    await generatePlugin({
      root, pluginId: 'example', type, scope: '@example',
      ...(isModule ? { moduleId: 'extra', pluginPackage: '@example/plugin-example' } : {}),
    });
    const path = `plugins/${frontend ? 'frontend' : 'backend'}/${name}`;
    const packageName = `@example/plugin-${name}`;
    const manifest = JSON.parse(await readFile(join(root, path, 'package.json'), 'utf8'));
    expect(manifest.name).toBe(packageName);
    expect(manifest.backstage.role).toBe(type);
    expect(existsSync(join(root, path, 'src', 'index.ts'))).toBe(true);
    expect(existsSync(join(root, path, 'tsconfig.json'))).toBe(true);
    const workspace = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    expect(workspace.workspaces).toContain(path);
    const tsconfig = JSON.parse(await readFile(join(root, 'tsconfig.json'), 'utf8'));
    expect(tsconfig.references).toContainEqual({ path: `./${path}` });
    const host = frontend ? 'app' : 'backend';
    const hostManifest = JSON.parse(await readFile(join(root, 'packages', host, 'package.json'), 'utf8'));
    expect(hostManifest.dependencies[packageName]).toBe('workspace:^');
    const source = await readFile(join(root, 'packages', host, 'src', frontend ? 'App.tsx' : 'index.ts'), 'utf8');
    expect(source).toContain(packageName);
  }, 30000);

  it('does not change repository files in dry-run mode', async () => {
    const before = await readFile(join(root, 'package.json'), 'utf8');
    await generatePlugin({ root, pluginId: 'example', type: 'frontend-plugin', scope: '@example', dryRun: true });
    expect(await readFile(join(root, 'package.json'), 'utf8')).toBe(before);
    expect(existsSync(join(root, 'plugins'))).toBe(false);
  }, 30000);

  it('rejects invalid names and unsupported runtime layouts without changes', async () => {
    await expect(generatePlugin({ root, pluginId: '../outside', type: 'frontend-plugin', scope: '@example' })).rejects.toThrow('Plugin and module IDs');
    await write('packages/backend/src/index.ts', 'export const unsupported = true;\n');
    await expect(generatePlugin({ root, pluginId: 'example', type: 'backend-plugin', scope: '@example' })).rejects.toThrow('Unsupported backend entrypoint');
    expect(existsSync(join(root, 'plugins'))).toBe(false);
  });

  it('rejects symlink destinations and existing output directories', async () => {
    await mkdir(join(root, 'plugins'), { recursive: true });
    await symlink(join(root, 'packages'), join(root, 'plugins', 'frontend'));
    await expect(generatePlugin({ root, pluginId: 'example', type: 'frontend-plugin', scope: '@example' }))
      .rejects.toThrow('symbolic link');
    await mkdir(join(root, 'plugins', 'backend', 'example-backend'), { recursive: true });
    await expect(generatePlugin({ root, pluginId: 'example', type: 'backend-plugin', scope: '@example' }))
      .rejects.toThrow('already exists');
  });

  it('honors a custom path and rejects a repeated generation', async () => {
    const options = { root, pluginId: 'example', type: 'frontend-plugin' as const, scope: '@custom', path: 'custom/example' };
    await generatePlugin(options);
    const manifest = JSON.parse(await readFile(join(root, 'custom/example/package.json'), 'utf8'));
    expect(manifest.name).toBe('@custom/plugin-example');
    await expect(generatePlugin(options)).rejects.toThrow('already exists');
  }, 30000);

  it('restores prior edits if an entrypoint cannot be safely replaced', async () => {
    const rootManifest = await readFile(join(root, 'package.json'), 'utf8');
    const config = await readFile(join(root, 'tsconfig.json'), 'utf8');
    const hostManifest = await readFile(join(root, 'packages/app/package.json'), 'utf8');
    const entrypoint = join(root, 'packages/app/src/App.tsx');
    const original = await readFile(entrypoint, 'utf8');
    await write('app-source.tsx', original);
    await rm(entrypoint);
    await symlink(join(root, 'app-source.tsx'), entrypoint);
    await expect(generatePlugin({ root, pluginId: 'example', type: 'frontend-plugin', scope: '@example' }))
      .rejects.toThrow('Generated files may remain');
    expect(await readFile(join(root, 'package.json'), 'utf8')).toBe(rootManifest);
    expect(await readFile(join(root, 'tsconfig.json'), 'utf8')).toBe(config);
    expect(await readFile(join(root, 'packages/app/package.json'), 'utf8')).toBe(hostManifest);
    expect(await readFile(entrypoint, 'utf8')).toBe(original);
  }, 30000);

  it('rejects ambiguous frontend configuration instead of changing it', () => {
    const source = "import { createApp } from '@backstage/frontend-defaults';\ncreateApp({ features: [], ...other });";
    expect(() => registerRuntime(source, '@example/plugin-example', true, 'App.tsx')).toThrow('features must be an array literal');
    const duplicate = "import { createApp } from '@backstage/frontend-defaults';\ncreateApp({ features: [], 'features': [] });";
    expect(() => registerRuntime(duplicate, '@example/plugin-example', true, 'App.tsx')).toThrow('features must be an array literal');
  });
});
