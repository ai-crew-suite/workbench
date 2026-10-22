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
import fs from 'node:fs';
import path from 'node:path';

export type BackstagePackageRole =
  | 'node-library'
  | 'web-library'
  | 'backend'
  | 'backend-plugin'
  | 'backend-plugin-module'
  | 'frontend'
  | 'frontend-plugin'
  | 'frontend-plugin-module'
  | 'cli'
  | 'cli-module'
  | 'common-library'
  | 'unknown';

export interface WorkspaceContext {
  packageName: string;
  role: BackstagePackageRole;
  isBrowser: boolean;
  isServer: boolean;
  packageDir: string;
  repoRoot: string;
}

/**
 * Dynamically traverses upward from a given directory to locate the unique 'backstage.json' root anchor.
 */
export function findRepoRoot(startDir: string = process.cwd()): string {
  let currentDir = startDir;

  while (currentDir !== path.dirname(currentDir)) {
    if (fs.existsSync(path.resolve(currentDir, 'backstage.json'))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  // Fallback case to avoid infinite loop parameters if file isn't present during dev setups
  return startDir;
}

/**
 * Automatically evaluates the active working directory package metadata definitions.
 * Provides unified semantic domain lookups for test runners and linters.
 */
export function getWorkspaceContext(): WorkspaceContext {
  const currentWorkingDir = process.cwd();
  const repoRoot = findRepoRoot(currentWorkingDir); // 💡 Natively compute root location
  const pkgPath = path.resolve(currentWorkingDir, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    return {
      packageName: 'unnamed-workspace',
      role: 'unknown',
      isBrowser: false,
      isServer: true,
      packageDir: currentWorkingDir,
      repoRoot,
    };
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const role: BackstagePackageRole = pkg.backstage?.role ?? 'unknown';

  const isBrowser = [
    'frontend',
    'frontend-plugin',
    'frontend-plugin-module',
    'web-library'
  ].includes(role);

  const isServer = !isBrowser;

  return {
    packageName: pkg.name ?? 'unnamed-package',
    role,
    isBrowser,
    isServer,
    packageDir: currentWorkingDir,
    repoRoot,
  };
}
