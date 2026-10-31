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
import chalk from 'chalk';
import { WireMockClient } from './wiremock-client';
import { getAllProgrammaticMappings } from '@ai-crew-suite/fixtures-external';
import { getAllKubernetesMappings } from '@ai-crew-suite/fixtures-kubernetes';

export interface SeederOptions {
  source: string;
  port: string;
  host: string;
  clear: boolean;
}

export async function runWiremockSeeder(options: SeederOptions): Promise<void> {
  const protocol = options.host.startsWith('http') ? '' : 'http://';
  const baseUrl = `${protocol}${options.host}:${options.port}`;

  console.log(`📡 Connecting to WireMock control plane at: ${chalk.cyan(baseUrl)}`);

  const client = new WireMockClient(baseUrl);

  if (options.clear) {
    console.log(chalk.yellow('🧹 --clear flag detected. Resetting active mock mapping registries...'));
    await client.clearDynamicMocks();
  }

  let injectionPayloads: any[] = [];

  // Check if token maps cleanly to monorepo default definitions
  if (options.source === 'external') {
    console.log(
      `📦 Resolving programmatic vendor fixtures from ${chalk.green('@ai-crew-suite/fixtures-external')}...`
    );

    injectionPayloads = getAllProgrammaticMappings();

  } else if (options.source === 'kubernetes') {
    console.log(
      `📦 Resolving cluster infrastructure routing fixtures from ${chalk.green('@ai-crew-suite/fixtures-kubernetes')}...`
    );

    injectionPayloads = getAllKubernetesMappings();

  } else {
    // Fall back to manual file path ingestion parsing
    const resolvedPath = path.resolve(options.source);

    console.log(`📂 Evaluating custom payload filesystem path target: ${chalk.cyan(resolvedPath)}`);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(
        `Invalid source layout reference. Could not detect fixture target file asset at: ${resolvedPath}`
      );
    }

    try {
      const rawData = fs.readFileSync(resolvedPath, 'utf-8');
      const parsedData = JSON.parse(rawData);

      injectionPayloads = Array.isArray(parsedData) ? parsedData : [parsedData];

    } catch (err: any) {
      throw new Error(`Failed to parse target JSON file resource configuration: ${err.message}`);
    }
  }

  console.log(
    `🚀 Commencing injection pipeline cascade for [${chalk.yellow(injectionPayloads.length)}] mock structural schemas...`
  );

  let successfulIngestions = 0;
  for (const stub of injectionPayloads) {
    try {
      await client.registerStub(stub);
      successfulIngestions++;

    } catch (err: any) {
      console.error(chalk.red(
        `❌ Ingestion failed for stub rule: ${stub.name || 'Unnamed Stub'} -> ${err.message}`)
      );
    }
  }

  console.log(
    `\n🎉 ${chalk.green('Seeding execution complete.')} Successfully ingested [${successfulIngestions}/${injectionPayloads.length}] mock mappings.\n`
  );
}
