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
// packages/backstage/app/src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { createApp } from '@backstage/app-defaults';
import { FlatRoutes } from '@backstage/core-app-api';
import { Route } from 'react-router-dom';

/**
 * Reusable workbench bootstrapper for isolated plugin UI development.
 * Consuming frontend plugins call this from their local `dev/index.tsx` file.
 */
export function bootstrapFrontendWorkbench(PluginComponent: React.ComponentType) {
  const app = createApp({
    plugins: [],
    apis: [], // Bind standard corporate global mock APIs here if needed
  });

  const AppProvider = app.getProvider();
  const AppRouter = app.getRouter();

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <AppProvider>
        <AppRouter>
          <FlatRoutes>
            {/* Automatically mount the plugin under test onto the root directory route */}
            <Route path="/" element={<PluginComponent />} />
          </FlatRoutes>
        </AppRouter>
      </AppProvider>
    </React.StrictMode>
  );
}
