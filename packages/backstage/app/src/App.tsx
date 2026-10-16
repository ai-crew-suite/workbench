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
import { ReactNode, useEffect } from 'react';
import { createApp } from '@backstage/frontend-defaults';
import {
  AppRootWrapperBlueprint,
  SignInPageBlueprint,
  ThemeBlueprint,
} from '@backstage/plugin-app-react';
import {
  createFrontendModule,
  FrontendFeature,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import { Navigate } from 'react-router-dom';
import { UnifiedThemeProvider, type UnifiedTheme } from '@backstage/theme';
import apiDocsPlugin from '@backstage/plugin-api-docs/alpha';
import appVisualizerPlugin from '@backstage/plugin-app-visualizer';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import catalogGraphPlugin from '@backstage/plugin-catalog-graph/alpha';
import kubernetesPlugin from '@backstage/plugin-kubernetes/alpha';
import notificationsPlugin from '@backstage/plugin-notifications/alpha';
import orgPlugin from '@backstage/plugin-org/alpha';
import scaffolderPlugin from '@backstage/plugin-scaffolder/alpha';
import searchPlugin from '@backstage/plugin-search/alpha';
import signalsPlugin from '@backstage/plugin-signals/alpha';
import techdocsPlugin from '@backstage/plugin-techdocs/alpha';
import userSettingsPlugin from '@backstage/plugin-user-settings/alpha';
import {
  ThemeProvider as LegacyThemeProvider,
  StylesProvider,
} from '@material-ui/core/styles';
import CssBaseline from '@mui/material/CssBaseline';
import GlobalStyles from '@mui/material/GlobalStyles';
import { DevErrorBoundary } from './errorBoundary';
import { backstageLightTheme, backstageDarkTheme } from './themes';
import { customNavModule } from './plugins/nav';

console.log('[Dev-Workbench] Shared wrapper bundle evaluated completely.');

interface BuildAppOptions {
  TargetPlugin: FrontendFeature;
}

interface WorkbenchThemeProvidersProps {
  /** Unified theme applied to both the MUI v5 and legacy MUI v4 providers. */
  theme: UnifiedTheme;
  children: ReactNode;
}

/**
 * Shared theme provider stack for the dev workbench. Pairs the unified
 * (MUI v5) theme with a legacy (MUI v4) theme provider so both component
 * generations resolve styles from the same palette, and pins the legacy
 * SidebarPage layout gutter to the width of the fixed custom sidebar rail.
 */
const WorkbenchThemeProviders = ({
  theme,
  children,
}: WorkbenchThemeProvidersProps) => (
  <UnifiedThemeProvider theme={theme}>
    <LegacyThemeProvider theme={theme}>
      <StylesProvider injectFirst>
        <CssBaseline />
        <GlobalStyles
          styles={{
            // The new-framework app layout wraps nav and page content in the
            // legacy `SidebarPage` (MUI v4), which reserves layout space with a
            // `padding-left` driven by its internal "pin" state (224px when
            // pinned, and it defaults to pinned). Our custom sidebar is a
            // fixed 72px rail, so force the reserved space to match it. The
            // attribute selector survives the JSS-generated class suffixes.
            '[class*="BackstageSidebarPage-root"]': {
              paddingLeft: '72px !important',
            },
          }}
        />
        {children}
      </StylesProvider>
    </LegacyThemeProvider>
  </UnifiedThemeProvider>
);


export function buildDevApp({ TargetPlugin }: BuildAppOptions) {
  const features: FrontendFeature[] = [
    apiDocsPlugin,
    appVisualizerPlugin,
    catalogGraphPlugin,
    catalogPlugin,
    customNavModule,
    kubernetesPlugin,
    notificationsPlugin,
    orgPlugin,
    scaffolderPlugin,
    searchPlugin,
    signalsPlugin,
    TargetPlugin,
    techdocsPlugin,
    userSettingsPlugin,
  ];

  const orchestratorCoreDefaultsModule = createFrontendModule({
    pluginId: 'app',
    extensions: [
      // Binds the otherwise route-less root URL (the browser's default entry
      // point and the sidebar logo link) to the catalog landing page.
      PageBlueprint.make({
        name: 'home-redirect',
        params: {
          path: '/',
          loader: async () => <Navigate to="/catalog" replace />,
        },
      }),
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
              <WorkbenchThemeProviders theme={backstageLightTheme}>
                {children}
              </WorkbenchThemeProviders>
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
              <WorkbenchThemeProviders theme={backstageDarkTheme}>
                {children}
              </WorkbenchThemeProviders>
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
