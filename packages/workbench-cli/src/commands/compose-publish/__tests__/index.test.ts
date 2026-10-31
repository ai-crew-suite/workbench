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
import { afterEach, describe, expect, it, vi } from 'vitest';

const { publish } = vi.hoisted(() => ({ publish: vi.fn() }));
vi.mock('../src/publish', () => ({ runComposePublish: publish }));

import execute from '../index';

const info = { name: 'workbench compose publish', usage: 'backstage-cli workbench compose publish' };

describe('compose publish command', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    publish.mockReset();
  });

  it('forwards CLI options and waits for the action', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await execute({ args: ['--registry', 'registry.example/team', '--tag', 'v1', '--plain-http'], info });
    expect(publish).toHaveBeenCalledWith({
      registry: 'registry.example/team',
      imageTag: 'v1',
      plainHttp: true,
    });
  });

  it('rejects when the action fails', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    publish.mockRejectedValue(new Error('publish failed'));
    await expect(execute({ args: [], info })).rejects.toThrow('publish failed');
  });
});
