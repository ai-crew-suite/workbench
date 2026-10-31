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
import { randomUUID } from 'node:crypto';
import { constants, existsSync } from 'node:fs';
import { access, chmod, copyFile, cp, lstat, mkdir, mkdtemp, open, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { findRepoRoot } from '../../../utils/workspace';
import { registerRuntime } from './registration';

/** Template roles available to the generator. */
export type TemplateRole = 'frontend-plugin' | 'frontend-plugin-module' | 'backend-plugin' | 'backend-plugin-module';

/** Options for generating and registering one plugin or module. */
export interface GeneratorOptions {
  root?: string;
  pluginId: string;
  type: TemplateRole;
  moduleId?: string;
  pluginPackage?: string;
  scope: string;
  path?: string;
  dryRun?: boolean;
}

interface Edit {
  path: string;
  original: string;
  content: string;
}

async function atomicReplace(edit: Edit, expected: string, content: string): Promise<void> {
  const info = await lstat(edit.path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Not a regular file: ${edit.path}`);
  const staged = join(dirname(edit.path), `.workbench-edit-${randomUUID()}`);
  let created = false;
  try {
    const handle = await open(staged, 'wx', info.mode);
    created = true;
    try {
      await handle.writeFile(content);
    } finally {
      await handle.close();
    }
    await chmod(staged, info.mode);
    if (await readFile(edit.path, 'utf8') !== expected) {
      throw new Error(`${edit.path} changed during generation; retry.`);
    }
    const current = await lstat(edit.path);
    if (!current.isFile() || current.isSymbolicLink() || current.ino !== info.ino || current.dev !== info.dev) {
      throw new Error(`${edit.path} was replaced during generation; retry.`);
    }
    await rename(staged, edit.path);
  } catch (error) {
    try {
      if (created) await rm(staged, { force: true });
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], `Could not remove temporary file ${staged} after an edit failed.`);
    }
    throw error;
  }
}

function parseObject(text: string, file: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${file} must contain a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

async function loadObject(file: string): Promise<{ text: string; value: Record<string, unknown> }> {
  const text = await readFile(file, 'utf8');
  return { text, value: parseObject(text, file) };
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function assertSafeDestination(root: string, destination: string): Promise<void> {
  const subpath = relative(root, destination);
  if (!subpath || subpath === '..' || subpath.startsWith(`..${sep}`) || isAbsolute(subpath)) {
    throw new Error('The output directory must be inside the repository.');
  }
  let current = root;
  for (const part of subpath.split(sep)) {
    current = join(current, part);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink()) throw new Error(`Output path contains a symbolic link: ${current}`);
      if (current === destination) throw new Error(`Output directory already exists: ${current}`);
      if (!info.isDirectory()) throw new Error(`Output path is not a directory: ${current}`);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return;
      throw error;
    }
  }
}

async function copyIfPresent(source: string, destination: string): Promise<void> {
  try {
    await copyFile(source, destination, constants.COPYFILE_EXCL);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return;
    throw error;
  }
}

async function renderTemplate(root: string, temp: string, options: GeneratorOptions, baseName: string): Promise<string> {
  const packageRoot = dirname(require.resolve('@ai-crew-suite/cli-module-workbench/package.json'));
  const sourceTemplates = join(packageRoot, 'src/commands/code-generator/templates');
  const templateRoot = join(existsSync(sourceTemplates) ? sourceTemplates : join(packageRoot, 'dist/templates'), options.type);
  await access(join(templateRoot, 'portable-template.yaml'));
  const templatePointer = relative(temp, templateRoot).split(sep).join('/');
  await writeFile(join(temp, 'package.json'), json({
    private: true,
    workspaces: ['plugins/*'],
    backstage: { cli: { new: {
      templates: [templatePointer.startsWith('.') ? templatePointer : `./${templatePointer}`],
      globals: { namePrefix: `${options.scope}/`, namePluginInfix: 'plugin-' },
    } } },
  }));
  await writeFile(join(temp, 'backstage.json'), '{}');
  await copyIfPresent(join(root, 'yarn.lock'), join(temp, 'yarn.lock'));
  await copyIfPresent(join(root, '.yarnrc.yml'), join(temp, '.yarnrc.yml'));

  const cliNode = require.resolve('@backstage/cli-node');
  const newModule = require.resolve('@backstage/cli-module-new');
  const bootstrap = `const {runCli}=require(${JSON.stringify(cliNode)}); runCli({modules:[require(${JSON.stringify(newModule)}).default],name:'backstage-cli'});`;
  const args = ['-e', bootstrap, 'workbench-template', 'new', '--select', options.type,
    '--option', `pluginId=${options.pluginId}`, '--skip-install'];
  if (options.moduleId) args.push('--option', `moduleId=${options.moduleId}`);
  if (options.pluginPackage) args.push('--option', `pluginPackage=${options.pluginPackage}`);
  const child = spawn(process.execPath, args, { cwd: temp, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout?.on('data', chunk => { output += String(chunk); });
  child.stderr?.on('data', chunk => { output += String(chunk); });
  await new Promise<void>((done, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code !== 0) reject(new Error(`Backstage template generation failed${signal ? ` (${signal})` : ` (${code})`}: ${output.trim()}`));
      else done();
    });
  });
  const rendered = join(temp, 'plugins', baseName);
  const manifestPath = join(rendered, 'package.json');
  try {
    const manifest = await loadObject(manifestPath);
    if (manifest.value['name'] !== `${options.scope}/plugin-${baseName}`) throw new Error('Unexpected generated package name.');
    await access(join(rendered, 'src', 'index.ts'));
  } catch (error) {
    throw new Error(`Backstage did not generate the expected package: ${output.trim()}`, { cause: error });
  }
  await writeFile(join(rendered, 'tsconfig.json'), json({
    extends: '@backstage/cli/config/tsconfig.json',
    compilerOptions: { composite: true, rootDir: '.', outDir: 'dist-types' },
    include: ['src', 'dev'],
    exclude: ['node_modules'],
  }));
  return rendered;
}

async function buildEdits(root: string, path: string, packageName: string, frontend: boolean): Promise<Edit[]> {
  const rootPackagePath = join(root, 'package.json');
  const rootPackage = await loadObject(rootPackagePath);
  const workspaces = rootPackage.value['workspaces'];
  if (!Array.isArray(workspaces) || !workspaces.every(item => typeof item === 'string')) {
    throw new Error('The root package.json must have a workspaces array.');
  }
  if (!workspaces.includes(path)) workspaces.push(path);

  const tsconfigPath = join(root, 'tsconfig.json');
  const tsconfig = await loadObject(tsconfigPath);
  const references = tsconfig.value['references'];
  if (!Array.isArray(references)) throw new Error('The root tsconfig.json must have a references array.');
  const ref = `./${path}`;
  if (references.some(item => item && typeof item === 'object' && item.path === ref)) {
    throw new Error(`TypeScript reference ${ref} is already registered.`);
  }
  references.push({ path: ref });

  const hostDir = join(root, 'packages', frontend ? 'app' : 'backend');
  const hostPath = join(hostDir, 'package.json');
  const host = await loadObject(hostPath);
  const dependencies = host.value['dependencies'] ?? {};
  if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)) {
    throw new Error(`${hostPath} dependencies must be an object.`);
  }
  if (packageName in dependencies) throw new Error(`${packageName} is already a dependency of ${hostPath}.`);
  host.value['dependencies'] = { ...dependencies, [packageName]: 'workspace:^' };

  const entrypoint = join(hostDir, 'src', frontend ? 'App.tsx' : 'index.ts');
  const source = await readFile(entrypoint, 'utf8');
  return [
    { path: rootPackagePath, original: rootPackage.text, content: json(rootPackage.value) },
    { path: tsconfigPath, original: tsconfig.text, content: json(tsconfig.value) },
    { path: hostPath, original: host.text, content: json(host.value) },
    { path: entrypoint, original: source, content: registerRuntime(source, packageName, frontend, entrypoint) },
  ];
}

/** Generates a template in isolation and registers it in a conventional Backstage monorepo. */
export async function generatePlugin(options: GeneratorOptions): Promise<void> {
  const id = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!id.test(options.pluginId) || (options.moduleId && !id.test(options.moduleId))) {
    throw new Error('Plugin and module IDs must be lowercase letters, digits, and single dashes.');
  }
  const isModule = options.type.endsWith('-module');
  if (isModule && (!options.moduleId || !options.pluginPackage)) throw new Error('Module templates require --module-id and --plugin-package.');
  if (!isModule && (options.moduleId || options.pluginPackage)) throw new Error('--module-id and --plugin-package are only valid for modules.');
  if (!/^@[a-z0-9][a-z0-9._-]*$/.test(options.scope)) throw new Error('Scope must be a valid lowercase npm scope, for example @ai-crew-suite.');
  if (options.pluginPackage && !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(options.pluginPackage)) {
    throw new Error('Parent plugin package must be a valid lowercase npm package name.');
  }
  const root = await realpath(options.root ?? findRepoRoot());
  await access(join(root, 'backstage.json'));
  const frontend = options.type.startsWith('frontend');
  const baseName = `${options.pluginId}${frontend ? '' : '-backend'}${isModule ? `-module-${options.moduleId}` : ''}`;
  const packageName = `${options.scope}/plugin-${baseName}`;
  const requestedPath = options.path ?? `plugins/${frontend ? 'frontend' : 'backend'}/${baseName}`;
  if (isAbsolute(requestedPath)) throw new Error('--path must be relative to the repository.');
  const destination = resolve(root, requestedPath);
  await assertSafeDestination(root, destination);
  const workspacePath = relative(root, destination).split(sep).join('/');
  const edits = await buildEdits(root, workspacePath, packageName, frontend);
  const temp = await mkdtemp(join(tmpdir(), 'workbench-generator-'));
  try {
    const rendered = await renderTemplate(root, temp, options, baseName);
    if (options.dryRun) {
      console.log(`Would generate ${packageName} in ${workspacePath} and update:\n${edits.map(edit => `  ${relative(root, edit.path)}`).join('\n')}`);
      return;
    }
    for (const edit of edits) {
      if (await readFile(edit.path, 'utf8') !== edit.original) throw new Error(`${edit.path} changed during generation; retry.`);
    }
    await assertSafeDestination(root, destination);
    await mkdir(dirname(destination), { recursive: true });
    await mkdir(destination);
    const applied: Edit[] = [];
    try {
      await cp(rendered, destination, { recursive: true, errorOnExist: true });
      for (const edit of edits) {
        await atomicReplace(edit, edit.original, edit.content);
        applied.push(edit);
      }
    } catch (error) {
      const failures: Error[] = [];
      for (const edit of applied.reverse()) {
        try {
          await atomicReplace(edit, edit.content, edit.original);
        } catch (rollbackError) {
          failures.push(new Error(`Could not restore ${edit.path}; inspect it manually.`, { cause: rollbackError }));
        }
      }
      failures.push(new Error(`Generated files may remain at ${destination}; inspect and remove them manually if appropriate.`));
      throw new AggregateError([error, ...failures], `Generation failed: ${String(error)}. ${failures.map(failure => failure.message).join(' ')}`);
    }
    console.log(`Generated and registered ${packageName} in ${workspacePath}. Run yarn install before starting the application.`);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
