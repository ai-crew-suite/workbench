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
// packages/backstage/app/src/App.tsx
import React, { ErrorInfo, ReactNode, useEffect } from 'react';
import { createApp } from '@backstage/frontend-defaults';
import { AppRootWrapperBlueprint, SignInPageBlueprint, ThemeBlueprint } from '@backstage/plugin-app-react';
import { themes, UnifiedThemeProvider } from '@backstage/theme'; // 🌟 Added explicit UnifiedThemeProvider import
import {
  createFrontendModule,
  FrontendFeature,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import appVisualizerPlugin from '@backstage/plugin-app-visualizer';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import notificationsPlugin from '@backstage/plugin-notifications/alpha';
import searchPlugin from '@backstage/plugin-search/alpha';

import { navModule } from './modules/nav';

console.log('[Dev-Workbench] Shared wrapper bundle evaluated completely.');

export class DevErrorBoundary extends React.Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  override state = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Dev-Workbench] DevErrorBoundary caught a crash:', error, errorInfo);
  }
  override render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, background: '#fff0f0', border: '5px solid red', color: '#a00' }}>
          <h2>🚨 Frontend Render Crash</h2>
          <pre>{this.state.error ? String(this.state.error) : 'Unknown Error'}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

interface BuildAppOptions {
  PluginComponent: React.ComponentType;
}

export function buildDevApp({ PluginComponent }: BuildAppOptions) {
  const customDevDiagnosticsModule = createFrontendModule({
    pluginId: 'app',
    extensions: [
      AppRootWrapperBlueprint.make({
        name: 'dev-error-overlay',
        params: {
          component: ({ children }: { children: ReactNode }) => <DevErrorBoundary>{children}</DevErrorBoundary>,
        },
      }),
      PageBlueprint.make({
        name: 'workbench-target-view',
        params: {
          path: '/',
          routeRef: null as any,
          loader: async () => {
            console.log('[Dev-Workbench] PageBlueprint loader executing view component...');
            return <PluginComponent />;
          },
        },
      }),
      ThemeBlueprint.make({
        name: 'light',
        params: {
          theme: {
            id: 'light',
            title: 'AI Crew Light Theme',
            variant: 'light',
            Provider: ({ children }: { children: ReactNode }) => (
              <UnifiedThemeProvider theme={themes.light} children={children} />
            ),
          },
        },
      }),
      ThemeBlueprint.make({
        name: 'dark',
        params: {
          theme: {
            id: 'dark',
            title: 'AI Crew Dark Theme',
            variant: 'dark',
            Provider: ({ children }: { children: ReactNode }) => (
              <UnifiedThemeProvider theme={themes.dark} children={children} />
            ),
          },
        },
      }),
      SignInPageBlueprint.make({
        params: {
          loader: async () => function AutoGuestSignIn(props) {
            useEffect(() => {
              props.onSignInSuccess({
                getProfileInfo: async () => ({
                  email: 'developer@ai-crew-suite.local',
                  displayName: 'Dev Guest User',
                }),
                getBackstageIdentity: async () => ({
                  type: 'user',
                  userEntityRef: 'user:default/guest',
                  ownershipEntityRefs: ['user:default/guest', 'group:default/developers'],
                }),
                getCredentials: async () => ({
                  token: 'u.' + btoa(JSON.stringify({ sub: 'user:default/guest', ent: ['user:default/guest'] }))
                }),
                signOut: async () => {
                  console.log('[Dev-Workbench] Local development environment session logout ignored.');
                },
              });
            }, [props]);

            return (
              <div style={{ padding: '2rem', fontFamily: 'sans-serif', textAlign: 'center' }}>
                <h2>🔑 Authenticating Sandbox Bench...</h2>
                <p>Establishing secure thread session under local guest identity context.</p>
              </div>
            );
          },
        },
      }),
    ],
  });

  const features: FrontendFeature[] = [
    appVisualizerPlugin,
    catalogPlugin,
    customDevDiagnosticsModule,
    navModule,
    notificationsPlugin,
    searchPlugin,
  ];

  console.log('[Dev-Workbench] Initializing App Next features array:', features);
  return createApp({ features });
}
