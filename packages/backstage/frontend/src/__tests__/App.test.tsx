// @vitest-environment jsdom
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
import { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createExtension, createFrontendModule } from '@backstage/frontend-plugin-api';

const mocks = vi.hoisted(() => {
  const createRoot = vi.fn(() => 'app-root');
  const createApp = vi.fn(() => ({ createRoot }));
  return { createApp, createRoot };
});

// 1. Mock the defaults and engine configurations
vi.mock('@backstage/frontend-defaults', () => ({ createApp: mocks.createApp }));
vi.mock('../plugins/nav/plugin', () => ({ customNavModule: 'navigation' }));

// 2. Mock out every complex upstream feature plugin imported by App.tsx
vi.mock('@backstage/plugin-catalog/alpha', () => ({ default: 'catalog' }));
vi.mock('@backstage/plugin-notifications/alpha', () => ({ default: 'notifications' }));
vi.mock('@backstage/plugin-search/alpha', () => ({ default: 'search' }));
vi.mock('@backstage/plugin-user-settings/alpha', () => ({ default: 'user-settings' }));
vi.mock('@backstage/plugin-app-visualizer', () => ({ default: 'app-visualizer' }));

vi.mock('@backstage/plugin-app-react/alpha', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@backstage/plugin-app-react')>();
  return {
    ...actual,
    AppRootWrapperBlueprint: {
      make: vi.fn(() => createExtension({
        kind: 'app',
        name: 'mocked-root-wrapper',
        attachTo: { id: 'app/root', input: 'components' },
        output: [],
        factory: () => [],
      })),
    },
    SignInPageBlueprint: {
      make: vi.fn(() => createExtension({
        kind: 'sign-in-page',
        name: 'mocked-sign-in',
        attachTo: { id: 'app/root', input: 'components' },
        output: [],
        factory: () => [],
      })),
    },
    ThemeBlueprint: {
      make: vi.fn(() => createExtension({
        kind: 'theme',
        name: 'mocked-theme',
        attachTo: { id: 'app/root', input: 'components' },
        output: [],
        factory: () => [],
      })),
    },
  };
});

vi.mock('@backstage/theme', () => ({
  createUnifiedTheme: vi.fn(() => ({})),
  palettes: {
    light: { primary: {} },
    dark: { primary: {} },
  },
  themes: {
    light: { id: 'light' },
    dark: { id: 'dark' },
  },
  UnifiedThemeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe('App Layout Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates the application root from the configured feature set', async () => {
    const { buildDevApp } = await import('../App');

    const TargetPlugin = createFrontendModule({
      pluginId: 'test-target-plugin',
      extensions: [
        createExtension({
          kind: 'app',
          name: 'test-target-plugin-root',
          attachTo: { id: 'app/root', input: 'components' },
          output: [],
          factory: () => [],
        }),
      ],
    });

    const app = buildDevApp({ TargetPlugin });

    expect(mocks.createApp).toHaveBeenCalled();
    expect(app.createRoot()).toBe('app-root');
  });
});
