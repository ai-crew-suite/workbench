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
import {
  CatalogProcessor,
  CatalogProcessorEmit,
  catalogProcessingExtensionPoint,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { createBackendModule } from '@backstage/backend-plugin-api';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parseAllDocuments } from 'yaml';

export class OptionalLocalFixturesProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'OptionalLocalFixturesProcessor';
  }

  async readLocation(
    location: LocationSpec,
    _optional: boolean,
    emit: CatalogProcessorEmit,
  ): Promise<boolean> {
    // 1. Only handle custom location type wrapper
    if (location.type !== 'crew-suite-optional-fixtures') {
      return false; // Hand control back to Backstage for other types
    }

    // Resolve the path relative to the active execution directory
    const filePath = resolve(process.cwd(), location.target);

    // 2. Exit cleanly without noise if the file is missing
    if (!existsSync(filePath)) {
      console.log(`[OptionalLocalFixturesProcessor] No optional local fixtures found at ${filePath}.`);
      return true; // Returning true signals: "I handled this type successfully, nothing to do."
    }

    // 3. If the file exists, read and parse its documents safely
    try {
      const fileContent = readFileSync(filePath, 'utf-8');
      const parsedDocuments = parseAllDocuments(fileContent);

      for (const doc of parsedDocuments) {
        const entity = doc.toJS();

        if (entity && entity.kind) {
          // Emit the parsed entity directly into the active streaming engine pipeline
          emit({
            type: 'entity',
            location,
            entity,
          });
          console.log(`[OptionalLocalFixturesProcessor] Successfully emitted entity from optional local fixture at ${filePath}.`);
        }
      }
    } catch (error) {
      // Log errors only if the file exists but has invalid YAML syntax
      console.error(`[OptionalLocalFixturesProcessor] Syntax error parsing ${filePath}:`, error);
    }

    return true;
  }
}

export const catalogOptionalLocalFixturesModule = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'optional-local-fixtures',
  register(env) {
    env.registerInit({
      deps: { catalog: catalogProcessingExtensionPoint },
      async init({ catalog }) {
        catalog.addProcessor(new OptionalLocalFixturesProcessor());
      },
    });
  },
});
