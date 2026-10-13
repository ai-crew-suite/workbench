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
import React, { ErrorInfo, ReactNode, useEffect } from 'react';
import { createApp } from '@backstage/frontend-defaults';
import {
  AppRootWrapperBlueprint,
  SignInPageBlueprint,
  ThemeBlueprint,
} from '@backstage/plugin-app-react';
import {
  createFrontendModule,
  FrontendFeature,
} from '@backstage/frontend-plugin-api';
import {
  UnifiedThemeProvider,
  createUnifiedTheme,
  palettes,
} from '@backstage/theme';
import appVisualizerPlugin from '@backstage/plugin-app-visualizer';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import notificationsPlugin from '@backstage/plugin-notifications/alpha';
import scaffolderPlugin from '@backstage/plugin-scaffolder/alpha';
import searchPlugin from '@backstage/plugin-search/alpha';
import userSettingsPlugin from '@backstage/plugin-user-settings/alpha';
import {
  ThemeProvider as LegacyThemeProvider,
  StylesProvider,
} from '@material-ui/core/styles';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import { customNavModule } from './plugins/nav/plugin';

console.log('[Dev-Workbench] Shared wrapper bundle evaluated completely.');

export class DevErrorBoundary extends React.Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
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
  TargetPlugin: FrontendFeature;
}

const backstageLightTheme = createUnifiedTheme({
  palette: {
    ...palettes.light, // Provides all mandatory tokens (status, navigation, borders) safely
    primary: {
      ...palettes.light.primary,
      main: '#1976d2',
    },
  },
});

const backstageDarkTheme = createUnifiedTheme({
  palette: {
    ...palettes.dark, // Provides all mandatory tokens (status, navigation, borders) safely
    primary: {
      ...palettes.dark.primary,
      main: '#90caf9',
    },
  },
});

export function buildDevApp({ TargetPlugin }: BuildAppOptions) {
  const features: FrontendFeature[] = [
    appVisualizerPlugin,
    catalogPlugin,
    customNavModule,
    notificationsPlugin,
    scaffolderPlugin,
    searchPlugin,
    userSettingsPlugin,
    TargetPlugin,
  ];

  const orchestratorCoreDefaultsModule = createFrontendModule({
    pluginId: 'app',
    extensions: [
      AppRootWrapperBlueprint.make({
        name: 'dev-error-overlay',
        params: { component: ({ children }: { children: ReactNode }) => <DevErrorBoundary>{children}</DevErrorBoundary> },
      }),
      ThemeBlueprint.make({
        name: 'light',
        params: {
          theme: {
            id: 'light',
            title: 'AI Crew Light Theme',
            variant: 'light',
            Provider: ({ children }: { children: ReactNode }) => (
              <UnifiedThemeProvider theme={backstageLightTheme}>
                <LegacyThemeProvider theme={backstageLightTheme}>
                  <StylesProvider injectFirst>
                    <CssBaseline />
                      <Box sx={{ display: 'flex', flexDirection: 'row', width: '100vw', height: '100vh', overflow: 'hidden' }}>
                        {children}
                      </Box>
                  </StylesProvider>
                </LegacyThemeProvider>
              </UnifiedThemeProvider>
            )
          }
        }
      }),
      ThemeBlueprint.make({
        name: 'dark',
        params: {
          theme: {
            id: 'dark',
            title: 'AI Crew Dark Theme',
            variant: 'dark',
            Provider: ({ children }: { children: ReactNode }) => (
              <UnifiedThemeProvider theme={backstageDarkTheme}>
                <LegacyThemeProvider theme={backstageDarkTheme}>
                  <StylesProvider injectFirst>
                    <CssBaseline />
                      <Box sx={{ display: 'flex', flexDirection: 'row', width: '100vw', height: '100vh', overflow: 'hidden' }}>
                        {children}
                      </Box>
                  </StylesProvider>
                </LegacyThemeProvider>
              </UnifiedThemeProvider>
            )
          }
        }
      }),
      SignInPageBlueprint.make({
        params: {
          loader: async () => function AutoGuestSignIn(props) {
            useEffect(() => {
              props.onSignInSuccess({
                getProfileInfo: async () => ({ email: 'developer@ai-crew-suite.local', displayName: 'Dev Guest User' }),
                getBackstageIdentity: async () => ({ type: 'user', userEntityRef: 'user:default/guest', ownershipEntityRefs: ['user:default/guest'] }),
                getCredentials: async () => ({ token: 'u.' + btoa(JSON.stringify({ sub: 'user:default/guest' })) }),
                signOut: async () => console.log('Logout ignored.'),
              });
            }, [props]);
            return <div>🔑 Authenticating Sandbox Bench...</div>;
          }
        }
      })
    ]
  });

  features.push(orchestratorCoreDefaultsModule);

  console.log('[Dev-Workbench] Initializing App Next features array:', features);
  return createApp({ features });
}
