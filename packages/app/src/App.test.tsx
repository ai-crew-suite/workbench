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
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const createRoot = vi.fn(() => 'app-root');
  const createApp = vi.fn(() => ({ createRoot }));
  return { createApp, createRoot };
});

vi.mock('@backstage/frontend-defaults', () => ({ createApp: mocks.createApp }));
vi.mock('@backstage/plugin-catalog/alpha', () => ({ default: 'catalog' }));
vi.mock('@backstage/plugin-notifications/alpha', () => ({
  default: 'notifications',
}));
vi.mock('@backstage/plugin-search/alpha', () => ({ default: 'search' }));
vi.mock(
  '@ai-crew-suite/plugin-agent-kubernetes-responder/alpha',
  () => ({
    default: 'kubernetes-ai-responder',
  }),
);
vi.mock(
  '@ai-crew-suite/plugin-agent-catalog-insights/alpha',
  () => ({
    default: 'catalog-ai-insights',
  }),
);
vi.mock(
  '@ai-crew-suite/plugin-agent-oncall-handover/alpha',
  () => ({ default: 'oncall-handover-assistant' })
);
vi.mock(
  '@ai-crew-suite/plugin-agent-release-notes-generator/alpha',
  () => ({ default: 'release-notes-ai-generator' })
);
vi.mock(
  '@ai-crew-suite/plugin-agent-rfc-adr-reviewer/alpha',
  () => ({ default: 'rfc-adr-ai-reviewer' })
);
vi.mock(
  '@ai-crew-suite/plugin-agent-alert-tuner-backend/alpha',
  () => ({ default: 'alert-ai-tuner' })
);
vi.mock(
  '@ai-crew-suite/plugin-agent-scaffolder-drift-detector/alpha',
  () => ({ default: 'scaffolder-ai-drift-detector' })
);
vi.mock(
  '@ai-crew-suite/plugin-agent-scaffolder-guardrail/alpha',
  () => ({ default: 'scaffolder-ai-guardrail-agent' })
);
vi.mock(
  '@ai-crew-suite/plugin-agent-scaffolder-infra/alpha',
  () => ({ default: 'scaffolder-ai-infra' })
);
vi.mock(
  '@ai-crew-suite/plugin-agent-scaffolder-intent/alpha',
  () => ({ default: 'scaffolder-ai-intent' })
);
vi.mock(
  '@ai-crew-suite/plugin-agent-scaffolder-shadow-detective/alpha',
  () => ({ default: 'scaffolder-ai-shadow-detective' })
);
vi.mock(
  '@ai-crew-suite/plugin-agent-scaffolder-prd/alpha',
  () => ({ default: 'scaffolder-ai-prd' })
);
vi.mock(
  '@ai-crew-suite/plugin-agent-search-archeology/alpha',
  () => ({ default: 'search-ai-archeology' })
);
vi.mock(
  '@ai-crew-suite/plugin-agent-search-context/alpha',
  () => ({ default: 'search-ai-context' })
);
vi.mock(
  '@ai-crew-suite/plugin-agent-tech-debt-scout/alpha',
  () => ({ default: 'tech-debt-ai-scout' })
);
vi.mock(
  '@ai-crew-suite/plugin-agent-tech-radar-manager/alpha',
  () => ({ default: 'tech-radar-ai-manager' })
);
vi.mock(
  '@ai-crew-suite/plugin-agent-techdocs-janitor/alpha',
  () => ({ default: 'techdocs-ai-janitor' })
);
vi.mock(
  '@ai-crew-suite/plugin-agent-techdocs-postmortem/alpha',
  () => ({ default: 'techdocs-ai-postmortem' })
);
vi.mock('./modules/nav', () => ({ navModule: 'navigation' }));

describe('App', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('creates the application root from the configured feature set', async () => {
    const { default: App } = await import('./App');

    expect(mocks.createApp).toHaveBeenCalledWith({
      features: [
        'catalog',
        'notifications',
        'search',
        'navigation',
        'kubernetes-ai-responder',
        'oncall-handover-assistant',
        'release-notes-ai-generator',
        'catalog-ai-insights',
        'alert-ai-tuner',
        'scaffolder-ai-drift-detector',
        'scaffolder-ai-guardrail-agent',
        'scaffolder-ai-infra',
        'scaffolder-ai-intent',
        'scaffolder-ai-shadow-detective',
        'scaffolder-ai-prd',
        'rfc-adr-ai-reviewer',
        'search-ai-archeology',
        'search-ai-context',
        'tech-debt-ai-scout',
        'tech-radar-ai-manager',
        'techdocs-ai-janitor',
        'techdocs-ai-postmortem',
      ],
    });
    expect(mocks.createRoot).toHaveBeenCalledWith();
    expect(App).toBe('app-root');
  });
});
