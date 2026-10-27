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

/**
 * Returns the absolute filesystem resolution path pointing to the
 * pre-compiled static HTML and search_index.json assets directory.
 *
 * Resolution starts at the consuming workspace so this works in CommonJS,
 * ESM, workspace links, and installed packages without relying on `__dirname`.
 */
export function getProgrammaticTechDocsPath(): string {
  const packageRequire = createRequire(path.resolve(process.cwd(), 'package.json'));
  const packageManifest = packageRequire.resolve('@ai-crew-suite/fixtures-techdocs/package.json');

  return path.resolve(path.dirname(packageManifest), 'static-compiled');
}
