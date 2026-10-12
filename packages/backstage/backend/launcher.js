#!/usr/bin/env node
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
const { spawn } = require('child_process');
const path = require('path');

const currentPluginRoot = process.cwd();
const skeletonPath = path.resolve(__dirname, './skeleton'); // Updated path

console.log(`[Dev-Backend] Booting with full Backstage CLI orchestration...`);

const backstageCliBinary = require.resolve('@backstage/cli/bin/backstage-cli');
const runArgs = ['package', 'start'];

const processEnv = {
  ...process.env,
  // Point to the YAML config inside the skeleton folder
  APP_CONFIG: path.resolve(skeletonPath, 'app-config.dev.yaml')
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
