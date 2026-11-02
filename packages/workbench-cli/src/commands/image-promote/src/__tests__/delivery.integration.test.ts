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
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ImageBuilder } from '../../../image-build/src/build';
import { DockerBuildService } from '../../../image-build/src/docker-build-service';
import { ImagePublisher } from '../../../image-publish/src/publish';
import { runStructureTests } from '../../../image-test-structure/src/test-structure';
import { readImageReceipt } from '../../../../utils/oci/image-receipt';
import { ImageRegistry } from '../../../../utils/oci/image-registry';
import { runImagePromote } from '../promote';

describe.skipIf(process.env['WORKBENCH_IMAGE_INTEGRATION'] !== '1')('real image delivery', () => {
  it('builds, tests, publishes, and manually promotes one disposable image', async () => {
    const root = mkdtempSync(join(tmpdir(), 'workbench-delivery-'));
    const target = `delivery-test-${randomUUID()}`;
    const targetDir = join(root, 'packages', target);
    const registry = `localhost:32443/workbench-test-${randomUUID()}`;
    let localTag: string | undefined;
    let candidate: string | undefined;
    try {
      mkdirSync(join(targetDir, '__tests__'), { recursive: true });
      writeFileSync(join(root, 'backstage.json'), '{}');
      writeFileSync(join(targetDir, 'package.json'), JSON.stringify({ name: target }));
      writeFileSync(join(root, 'test-file'), 'delivery test\n');
      writeFileSync(join(targetDir, 'Dockerfile'), 'FROM scratch\nCOPY test-file /test-file\nLABEL test.delivery="true"\n');
      writeFileSync(join(targetDir, '__tests__/test.cst.yaml'),
        'schemaVersion: "2.0.0"\nmetadataTest:\n  labels:\n    - key: test.delivery\n      value: "true"\n');
      vi.spyOn(process, 'cwd').mockReturnValue(root);
      const buildService = new DockerBuildService();
      vi.spyOn(buildService, 'pruneImages').mockResolvedValue(undefined);
      await new ImageBuilder(buildService).compileImage(root, target, targetDir);
      const built = readImageReceipt(targetDir, target);
      localTag = built.localTag;
      candidate = `${registry}/${target}:sha256-${built.imageId.slice(7)}`;
      await runStructureTests({ target });
      await new ImagePublisher().publishSingleImage(target, targetDir, { registry });
      const published = readImageReceipt(targetDir, target).publications[registry]!;
      await runImagePromote({ target, registry, tag: 'latest' });
      expect(await new ImageRegistry(registry).digest(`${registry}/${target}:latest`))
        .toBe(published.split('@')[1]);
    } finally {
      vi.restoreAllMocks();
      const cleanupErrors: string[] = [];
      if (candidate) {
        const deletion = spawnSync('oras', ['manifest', 'delete', '--plain-http', '--force', candidate], { encoding: 'utf8' });
        if (deletion.status !== 0) cleanupErrors.push(`Failed to delete disposable registry candidate ${candidate}: ${deletion.stderr}`);
      }
      if (localTag) {
        const removal = spawnSync('docker', ['image', 'rm', localTag], { encoding: 'utf8' });
        if (removal.status !== 0) cleanupErrors.push(`Failed to remove disposable local image ${localTag}: ${removal.stderr}`);
      }
      rmSync(root, { recursive: true, force: true });
      if (cleanupErrors.length) throw new Error(cleanupErrors.join('\n'));
    }
  }, 180000);
});
