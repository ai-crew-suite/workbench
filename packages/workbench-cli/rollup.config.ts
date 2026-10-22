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
import { globSync } from 'glob';
import { defineConfig } from 'rollup';
import dts from "rollup-plugin-dts";
import esbuild from "rollup-plugin-esbuild";
import fs from 'node:fs';
import path from 'node:path';
import resolve from '@rollup/plugin-node-resolve';

const currentDir = import.meta.dirname;

// Core input files for the CLI binary infrastructure
const entryPoints = globSync([
  path.resolve(currentDir, 'src/bin/crew.ts'),
  path.resolve(currentDir, 'src/bin/commands/**/*.ts'),
  path.resolve(currentDir, 'src/bin/utils/*.ts'),
]);

const executableEntryPattern = /\/src\/bin\/(crew|commands\/[^/]+\/index)\.ts$/;

/** Shared external module checker function */
const externalChecker = (id: string): boolean => {
  /** Keep relative imports and internal source files bundled/resolved correctly */
  if (id.startsWith('.') || path.isAbsolute(id)) {
    return false;
  }
  /** Force ALL node_modules packages, node built-ins, and third-party tools to be external */
  return true;
};

export default defineConfig([
  // Build the entire execution codebase (CLI binaries + Programmatic root index)
  {
    // Include the new src/index.ts alongside your standard CLI files
    input: [...entryPoints, path.resolve(currentDir, 'src/index.ts')],
    output: {
      dir: path.resolve(currentDir, 'dist'),
      format: 'esm',
      sourcemap: true,
      preserveModules: true,
      preserveModulesRoot: path.resolve(currentDir, 'src'), // Keeps "bin/" structure distinct from root index.js
      entryFileNames: '[name].js',
      /** Inject a shebang only into files intended to be invoked directly. */
      banner: ({ facadeModuleId }) =>
        facadeModuleId && executableEntryPattern.test(facadeModuleId)
          ? '#!/usr/bin/env node\n'
          : '',
    },
    external: externalChecker,
    plugins: [
      resolve(),
      esbuild({
        tsconfig: path.resolve(currentDir, './tsconfig.json')
      }),
      {
        name: 'make-executable',
        writeBundle() {
          if (process.platform !== 'win32') {
            /** Make the main entry binary executable */
            const entryPath = path.resolve(currentDir, 'dist/bin/crew.js');

            if (fs.existsSync(entryPath)) {
              fs.chmodSync(entryPath, 0o755);
            }

            /** Make all nested command binaries executable */
            const commandFiles = globSync(path.resolve(currentDir, 'dist/bin/commands/**/*.js'));

            for (const file of commandFiles) {
              if (fs.existsSync(file)) {
                fs.chmodSync(file, 0o755);
              }
            }

            console.log('⚡ Main binary and all subcommands marked as executable!');
          }
        }
      }
    ]
  },

  // Bundle 100% types into one single unified index.d.ts file
  {
    input: path.resolve(currentDir, 'src/index.ts'), // Traces public exports only
    output: {
      file: path.resolve(currentDir, 'dist/index.d.ts'),
      format: 'esm',
    },
    external: externalChecker,
    plugins: [
      resolve(),
      dts({
        tsconfig: path.resolve(currentDir, './tsconfig.json')
      })
    ]
  }
]);
