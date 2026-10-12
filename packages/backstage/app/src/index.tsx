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
import React from 'react';
import ReactDOM from 'react-dom/client';
import { createApp } from '@backstage/app-defaults';
import { FlatRoutes } from '@backstage/core-app-api';
import { Route } from 'react-router-dom';

// 1. Initialize your organizational standard branding layout shell
const app = createApp({
  plugins: [],
  apis: [], // Bind standard corporate global mock APIs here if needed
});

const AppProvider = app.getProvider();
const AppRouter = app.getRouter();

async function renderApp() {
  let ConsumerPluginPage = () => (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h2>Isolated Frontend Workbench Active</h2>
      <p>Please ensure your local frontend plugin exports a <code>RootPage</code> component target.</p>
    </div>
  );

  try {
    // Look directly into the calling site's runtime path to load the plugin
    // The Backstage CLI builder sets up alias mappings for local execution paths
    const consumerModule = await import('DYNAMIC_PLUGIN_ENTRY');

    if (consumerModule.RootPage) {
      ConsumerPluginPage = consumerModule.RootPage;
    } else if (consumerModule.default) {
      ConsumerPluginPage = consumerModule.default;
    }
  } catch (e) {
    console.warn('[Dev-Frontend] No custom entry component detected in active workspace. Using fallback screen.', e);
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <AppProvider>
      <AppRouter>
        <FlatRoutes>
          {/* Automatically mount and serve the plugin screen straight on the base route */}
          <Route path="/" element={<ConsumerPluginPage />} />
        </FlatRoutes>
      </AppRouter>
    </AppProvider>
  );
}

renderApp();
