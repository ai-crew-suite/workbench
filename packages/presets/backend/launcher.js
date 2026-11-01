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
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const currentPluginRoot = process.cwd();
const skeletonPath = path.resolve(__dirname, './skeleton');
const configPath = path.resolve(skeletonPath, 'empty-fallback.yaml');
const absoluteEntrypointPath = path.resolve(__dirname, 'src/index.ts');

console.log(`[Dev-Backend] Booting with full Backstage CLI orchestration...`);
console.log(`[Dev-Backend] Enforcing entrypoint: ${absoluteEntrypointPath}`);
console.log(`[Dev-Backend] Plugin entrypoint: ${currentPluginRoot}`);

const backstageCliBinary = require.resolve('@backstage/cli/bin/backstage-cli');

// 1. Establish core arguments, explicitly linking the entrypoint file location
const runArgs = ['package', 'start', '--config', configPath, '--entrypoint', absoluteEntrypointPath];

// 2. Resolve optional consumer-level config overrides (mirroring your frontend strategy)
const optionalLocalConfigPath = path.resolve(currentPluginRoot, 'dev/app-config.dev.yaml');
if (fs.existsSync(optionalLocalConfigPath)) {
  console.log(`[Dev-Backend] Loading local plugin config override: ${optionalLocalConfigPath}`);
  runArgs.push('--config', optionalLocalConfigPath);
}

// 3. Forward node inspector flags down to allow step-through debugging
if (process.argv.includes('--inspect')) runArgs.push('--inspect');
if (process.argv.includes('--inspect-brk')) runArgs.push('--inspect-brk');

const processEnv = {
  ...process.env,
  SWC_NATIVE_BINDING_CACHE: path.join(os.tmpdir(), '.swc-cache')
};

const child = spawn('node', [backstageCliBinary, ...runArgs], {
  cwd: currentPluginRoot,
  env: processEnv,
  stdio: 'inherit',
  shell: true
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});
