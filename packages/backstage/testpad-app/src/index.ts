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
import React from 'react';
import { createFrontendPlugin, PageBlueprint, createRouteRef } from '@backstage/frontend-plugin-api';

const CustomWorkspacePanel = () => {
  return React.createElement(
    'div',
    { style: { padding: '3rem', text: '#f0f4f8' } },
    React.createElement('h1', null, 'Hello from inside testpad-app!'),
    React.createElement('p', null, 'Your isolated frontend workbench wrapper is fully functional.')
  );
};

export const helloWorldPluginRouteRef = createRouteRef();

export default createFrontendPlugin({
  pluginId: 'custom-view-feature',
  extensions: [
    PageBlueprint.make({
      name: 'root-landing-page',
      params: {
        path: '/custom-feature',
        loader: async () => React.createElement(CustomWorkspacePanel),
      },
    }),
  ],
});
