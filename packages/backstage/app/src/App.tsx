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
import { createApp } from '@backstage/frontend-defaults';
import { createFrontendModule } from '@backstage/frontend-plugin-api';
import type { FrontendFeature } from '@backstage/frontend-plugin-api';
import { AppRootWrapperBlueprint } from '@backstage/plugin-app-react';
import appVisualizerPlugin from '@backstage/plugin-app-visualizer';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import notificationsPlugin from '@backstage/plugin-notifications/alpha';
import searchPlugin from '@backstage/plugin-search/alpha';
import React, { ErrorInfo, ReactNode } from 'react';

import { navModule } from './modules/nav';

// Define a clean error boundary UI overlay
class DevErrorBoundary extends React.Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  override state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Dev Boundary Catch:', error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      const errorInstance = this.state.error as Error | null;
      return (
        <div style={{ padding: 20, background: '#fff0f0', border: '5px solid red', color: '#a00' }}>
          <h2>🚨 Frontend Render Crash</h2>
          <pre>{errorInstance ? errorInstance.toString() : 'Unknown Framework Error'}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// Create a wrapper module that encapsulates the error boundary feature
const customDevDiagnosticsModule = createFrontendModule({
  pluginId: 'app',
  extensions: [
    AppRootWrapperBlueprint.make({
      name: 'dev-error-overlay',
      params: {
        component: ({ children }: { children: ReactNode }) => (
          <DevErrorBoundary>{children}</DevErrorBoundary>
        ),
      },
    }),
  ],
});

const features: FrontendFeature[] = [
  catalogPlugin,
  notificationsPlugin,
  searchPlugin,
  navModule,
  appVisualizerPlugin,          // Enables /visualizer route graph view
  customDevDiagnosticsModule,   // Captures code exceptions gracefully during hot-reloads
];

const app = createApp({
  features,
  advanced: {
    configLoader: async () => {
      return {
        config: {
          has: () => false,
          get: () => undefined,
          getString: () => '',
          getOptionalString: () => undefined,
        } as any
      };
    },
  },
});

export default app.createRoot();
