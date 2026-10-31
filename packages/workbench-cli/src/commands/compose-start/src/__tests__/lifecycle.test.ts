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
import { spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { LifecycleStore } from '../state';
import { isSameProcess, processIdentity } from '../processes';

const cli = resolve(process.cwd(), 'bin/backstage-cli-module-workbench');

async function waitFor<T>(check: () => Promise<T | undefined>, timeout = 20000): Promise<T> {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const result = await check();
    if (result !== undefined) return result;
    await delay(50);
  }
  throw new Error('Timed out waiting for the lifecycle test.');
}

describe.skipIf(process.platform === 'win32')('Compose lifecycle integration', () => {
  let root: string | undefined;
  let stateDirectory: string | undefined;
  let server: Server | undefined;
  let env: NodeJS.ProcessEnv;
  const children: ChildProcess[] = [];

  function run(args: string[]): ChildProcess {
    const child = spawn(process.execPath, [cli, 'workbench', 'compose', ...args], {
      cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.push(child);
    return child;
  }

  afterEach(async () => {
    if (root && env) {
      delete env['TEST_FAIL_DOWN'];
      const stop = run(['stop']);
      await new Promise<void>(resolveClose => stop.once('close', () => resolveClose()));
    }
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    }
    children.length = 0;
    if (server) await new Promise<void>((resolveClose, reject) => server!.close(error => error ? reject(error) : resolveClose()));
    if (root) await rm(root, { recursive: true, force: true });
    if (stateDirectory) await rm(stateDirectory, { recursive: true, force: true });
  });

  it('shares the stack, handles Ctrl+C independently, and stops only tracked processes', async () => {
    root = await mkdtemp(join(tmpdir(), 'workbench-lifecycle-test-'));
    const bin = join(root, 'bin');
    await mkdir(bin);
    await writeFile(join(root, 'backstage.json'), '{}');
    for (const target of ['app', 'backend']) {
      await mkdir(join(root, 'packages', target), { recursive: true });
      await writeFile(join(root, 'packages', target, 'package.json'), JSON.stringify({ scripts: { 'start:dev': 'fake' } }));
    }
    const log = join(root, 'docker.log');
    const docker = join(bin, 'docker');
    await writeFile(docker, [
      '#!/usr/bin/env node',
      "require('node:fs').appendFileSync(process.env.TEST_DOCKER_LOG, JSON.stringify(process.argv.slice(2)) + '\\n');",
      "if (process.env.TEST_FAIL_DOWN && process.argv.includes('down')) process.exit(1);",
    ].join('\n'));
    const yarn = join(bin, 'yarn');
    await writeFile(yarn, [
      '#!/usr/bin/env node',
      "const fs = require('node:fs');",
      "const { spawn } = require('node:child_process');",
      "const name = require('node:path').basename(process.cwd());",
      "const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });",
      "fs.writeFileSync(require('node:path').join(process.env.TEST_ROOT, `${name}.pid`), String(child.pid));",
      'setInterval(() => {}, 1000);',
    ].join('\n'));
    await chmod(docker, 0o755);
    await chmod(yarn, 0o755);
    env = {
      ...process.env, PATH: `${bin}:${process.env['PATH']}`, DOCKER_CONFIG: join(root, 'docker-config'),
      TEST_ROOT: root, TEST_DOCKER_LOG: log,
    };

    const body = Buffer.from('services:\n  web:\n    image: nginx\n');
    const digest = `sha256:${createHash('sha256').update(body).digest('hex')}`;
    let manifests = 0;
    server = createServer((request, response) => {
      if (request.url === '/v2/team/compose/manifests/latest') {
        manifests += 1;
        response.setHeader('content-type', 'application/vnd.oci.image.manifest.v1+json');
        response.end(JSON.stringify({ schemaVersion: 2, layers: [{
          mediaType: 'application/vnd.docker.compose.file+yaml', size: body.length, digest,
        }] }));
      } else if (request.url === `/v2/team/compose/blobs/${digest}`) {
        response.setHeader('content-type', 'application/octet-stream');
        response.end(body);
      } else response.writeHead(404).end();
    });
    await new Promise<void>(resolveListen => server!.listen(0, '127.0.0.1', resolveListen));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing registry address');
    const registry = `127.0.0.1:${address.port}/team`;
    const store = await LifecycleStore.create(root);
    stateDirectory = store.directory;
    const app = run(['start', 'app', '--registry', registry]);
    const backend = run(['start', 'backend', '--registry', registry]);
    const both = await waitFor(async () => {
      const state = await store.read();
      return state?.servers.app && state.servers.backend ? state : undefined;
    });
    expect(manifests).toBe(1);
    expect(both.phase).toBe('running');
    expect(isSameProcess(both.servers.app!.child)).toBe(true);
    expect(isSameProcess(both.servers.backend!.child)).toBe(true);
    const appGrandchild = await waitFor(async () => existsSync(join(root!, 'app.pid'))
      ? processIdentity(Number(await readFile(join(root!, 'app.pid'), 'utf8'))) : undefined);
    const backendGrandchild = await waitFor(async () => existsSync(join(root!, 'backend.pid'))
      ? processIdentity(Number(await readFile(join(root!, 'backend.pid'), 'utf8'))) : undefined);

    const duplicate = run(['start', 'backend', '--registry', registry]);
    expect(await new Promise<number | null>(resolveClose => duplicate.once('close', resolveClose))).not.toBe(0);

    if (!app.pid) throw new Error('App supervisor did not start');
    process.kill(app.pid, 'SIGINT');
    await waitFor(async () => {
      const state = await store.read();
      return state && !state.servers.app && state.servers.backend ? state : undefined;
    });
    expect(isSameProcess(appGrandchild)).toBe(false);
    expect(isSameProcess(both.servers.backend!.child)).toBe(true);
    expect((await readFile(log, 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line).at(-1))).not.toContain('down');

    env['TEST_FAIL_DOWN'] = '1';
    const failingStop = run(['stop']);
    expect(await new Promise<number | null>(resolveClose => failingStop.once('close', resolveClose))).not.toBe(0);
    expect((await store.read())?.phase).toBe('stopping');
    expect(isSameProcess(backendGrandchild)).toBe(false);
    delete env['TEST_FAIL_DOWN'];
    const stop = run(['stop']);
    const result = await new Promise<number | null>(resolveClose => stop.once('close', resolveClose));
    expect(result).toBe(0);
    expect(await store.read()).toBeUndefined();
    expect(isSameProcess(both.servers.backend!.child)).toBe(false);
    const calls: string[][] = (await readFile(log, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    expect(calls.filter(args => args.includes('up'))).toHaveLength(2);
    expect(calls.filter(args => args.includes('down'))).toHaveLength(2);
    expect(calls.at(-1)).not.toContain('--volumes');
    expect(backend.pid).toBeDefined();
  }, 40000);
});
