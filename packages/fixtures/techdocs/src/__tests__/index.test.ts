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
import { createRequire } from 'module';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getProgrammaticTechDocsPath } from '../index';

describe('Programmatic TechDocs asset resolution', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves the package asset directory when __dirname is unavailable', () => {
    vi.stubGlobal('__dirname', undefined);

    const assetPath = getProgrammaticTechDocsPath();
    const packageRequire = createRequire(path.resolve(process.cwd(), 'package.json'));
    const packageManifest = packageRequire.resolve('@ai-crew-suite/fixtures-techdocs/package.json');
    const expectedPath = path.resolve(path.dirname(packageManifest), 'static-compiled');

    expect(path.isAbsolute(assetPath)).toBe(true);
    expect(assetPath).toBe(expectedPath);
  });
});
