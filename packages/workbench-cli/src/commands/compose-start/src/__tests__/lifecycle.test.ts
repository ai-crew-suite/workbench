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
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const cli = resolve(process.cwd(), 'bin/backstage-cli-module-workbench');

describe.skipIf(process.platform === 'win32')('shared Compose lifecycle', () => {
  let directory: string;
  let home: string;
  let first: string;
  let second: string;
  let log: string;
  let projects: string;
  let server: Server;
  let registry: string;
  let env: NodeJS.ProcessEnv;
  let manifests: number;

  async function run(root: string, args: string[], overrides: NodeJS.ProcessEnv = {}) {
    const child = spawn(process.execPath, [cli, 'workbench', 'compose', ...args], {
      cwd: root, env: { ...env, ...overrides }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk.toString(); });
    child.stderr.on('data', chunk => { output += chunk.toString(); });
    const code = await new Promise<number | null>((resolveClose, reject) => {
      child.once('error', reject);
      child.once('close', resolveClose);
    });
    return { code, output };
  }

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'workbench-shared-test-'));
    home = join(directory, 'home');
    first = join(directory, 'first-repo');
    second = join(directory, 'second-repo');
    const bin = join(directory, 'bin');
    for (const dir of [home, first, second, bin]) await mkdir(dir);
    await writeFile(join(first, 'backstage.json'), '{}');
    await writeFile(join(second, 'backstage.json'), '{}');
    log = join(directory, 'docker.log');
    projects = join(directory, 'projects.json');
    await writeFile(projects, '[]');
    const preload = join(directory, 'fake-home.cjs');
    await writeFile(preload, [
      "const os = require('node:os');",
      'const original = os.userInfo;',
      "os.userInfo = (...args) => ({ ...original(...args), homedir: process.env.TEST_HOME });",
    ].join('\n'));
    const docker = join(bin, 'docker');
    await writeFile(docker, [
      '#!/usr/bin/env node',
      "const fs = require('node:fs');",
      "const args = process.argv.slice(2);",
      "fs.appendFileSync(process.env.TEST_DOCKER_LOG, JSON.stringify(args) + '\\n');",
      "if (args[0] === 'info') { console.log(process.env.TEST_DAEMON || 'daemon-one'); process.exit(0); }",
      "if (args[1] === 'ls') { console.log(fs.readFileSync(process.env.TEST_PROJECTS, 'utf8')); process.exit(0); }",
      "if (process.env.TEST_FAIL_DOWN && args.includes('down')) process.exit(1);",
      "if (process.env.TEST_FAIL_UP && args.includes('up')) process.exit(1);",
      "if (args.includes('up')) fs.writeFileSync(process.env.TEST_PROJECTS, JSON.stringify([{ Name: args[args.indexOf('--project-name') + 1], ConfigFiles: args[args.indexOf('-f') + 1] }]));",
      "if (args.includes('down')) fs.writeFileSync(process.env.TEST_PROJECTS, '[]');",
    ].join('\n'));
    await chmod(docker, 0o755);
    env = {
      ...process.env, HOME: home, PATH: `${bin}:${process.env['PATH']}`,
      DOCKER_CONFIG: join(home, '.docker'), TEST_DOCKER_LOG: log, TEST_PROJECTS: projects, TEST_HOME: home,
      NODE_OPTIONS: `${process.env['NODE_OPTIONS'] ?? ''} --require="${preload}"`,
    };
    const body = Buffer.from('services:\n  web:\n    image: nginx\n');
    const digest = `sha256:${createHash('sha256').update(body).digest('hex')}`;
    manifests = 0;
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
    await new Promise<void>(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing registry address');
    registry = `127.0.0.1:${address.port}/team`;
  });

  afterEach(async () => {
    if (server) await new Promise<void>((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it('serializes competing repositories, refuses the second, and permits cross-repository stop', async () => {
    const [one, two] = await Promise.all([
      run(first, ['start', '--registry', registry]),
      run(second, ['start', '--registry', registry]),
    ]);
    expect([one.code, two.code].sort()).toEqual([0, 1]);
    const owner = one.code === 0 ? first : second;
    const other = owner === first ? second : first;
    expect(one.code === 0 ? two.output : one.output).toContain(`reserved by ${owner.split('/').pop()}`);
    expect(manifests).toBe(1);
    const state = JSON.parse(await readFile(join(home, '.workbench-compose', 'workbench.pid'), 'utf8'));
    expect(state).toMatchObject({ root: owner, repository: owner.split('/').pop(), phase: 'running', daemonId: 'daemon-one' });
    expect(state).not.toHaveProperty('servers');
    const repeat = await run(owner, ['start', '--registry', registry]);
    expect(repeat.code, repeat.output).toBe(0);
    expect(manifests).toBe(1);
    const stopped = await run(other, ['stop']);
    expect(stopped.code, stopped.output).toBe(0);
    const calls: string[][] = (await readFile(log, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    expect(calls.filter(args => args.includes('up'))).toHaveLength(2);
    expect(calls.filter(args => args.includes('down'))).toHaveLength(1);
    expect(calls.find(args => args.includes('down'))).not.toContain('--volumes');
  }, 40000);

  it('retains failed lifecycle state for retry and rejects a different daemon', async () => {
    const failed = await run(first, ['start', '--registry', registry], { TEST_FAIL_UP: '1' });
    expect(failed.code).not.toBe(0);
    const path = join(home, '.workbench-compose', 'workbench.pid');
    expect(JSON.parse(await readFile(path, 'utf8')).phase).toBe('starting');
    expect((await run(second, ['stop'], { TEST_DAEMON: 'other-daemon' })).output).toContain('different Docker daemon');
    const retry = await run(first, ['start', '--registry', registry]);
    expect(retry.code, retry.output).toBe(0);
    const failStop = await run(second, ['stop'], { TEST_FAIL_DOWN: '1' });
    expect(failStop.code).not.toBe(0);
    expect(JSON.parse(await readFile(path, 'utf8')).phase).toBe('stopping');
    const stopped = await run(second, ['stop']);
    expect(stopped.code, stopped.output).toBe(0);
  }, 40000);

  it('detects and stops an earlier repository-scoped stack without managing its servers', async () => {
    const hash = createHash('sha256').update(home).update('\0').update(first).digest('hex').slice(0, 20);
    const oldDirectory = join(directory, `workbench-compose-${hash}`);
    await mkdir(oldDirectory, { mode: 0o700 });
    const composeFile = join(oldDirectory, 'compose.yml');
    const projectName = `workbench-${hash.slice(0, 12)}`;
    await writeFile(composeFile, 'services: {}\n');
    await writeFile(join(oldDirectory, 'workbench.pid'), JSON.stringify({
      version: 1, root: first, composeFile, projectName, servers: { backend: { child: { pid: process.pid } } },
    }));
    await writeFile(projects, JSON.stringify([{ Name: projectName, ConfigFiles: composeFile }]));
    const start = await run(second, ['start', '--registry', registry]);
    expect(start.code).not.toBe(0);
    expect(start.output).toContain('first-repo');
    const stop = await run(second, ['stop']);
    expect(stop.code, stop.output).toBe(0);
    expect(manifests).toBe(0);
  }, 40000);

  it('does not launch or terminate independent development processes', async () => {
    const marker = join(directory, 'yarn-called');
    const yarn = join(directory, 'bin', 'yarn');
    await writeFile(yarn, `#!/bin/sh\nprintf called > "${marker}"\nexit 1\n`);
    await chmod(yarn, 0o755);
    const independent = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      stdio: 'ignore',
    });
    try {
      await new Promise<void>((resolveSpawn, reject) => {
        independent.once('spawn', resolveSpawn);
        independent.once('error', reject);
      });
      const start = await run(first, ['start', '--registry', registry]);
      expect(start.code, start.output).toBe(0);
      const stop = await run(second, ['stop']);
      expect(stop.code, stop.output).toBe(0);
      expect(independent.exitCode).toBeNull();
      expect(independent.signalCode).toBeNull();
      await expect(readFile(marker)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      independent.kill('SIGTERM');
      await new Promise<void>(resolveClose => independent.once('close', () => resolveClose()));
    }
  }, 40000);

  it('rejects obsolete server targets and does not launch a dev server', async () => {
    const result = await run(first, ['start', 'backend', '--registry', registry]);
    expect(result.code).not.toBe(0);
    expect(result.output).toContain('too many arguments');
  });

  it('rejects malformed or lost shared state instead of starting another project', async () => {
    const started = await run(first, ['start', '--registry', registry]);
    expect(started.code, started.output).toBe(0);
    const path = join(home, '.workbench-compose', 'workbench.pid');
    await writeFile(path, JSON.stringify({ version: 2, root: first, repository: 'wrong' }));
    expect((await run(second, ['stop'])).output).toContain('Invalid workbench lifecycle state');
    await rm(path);
    expect((await run(second, ['start', '--registry', registry])).output).toContain('exists without its state file');
  }, 40000);
});
