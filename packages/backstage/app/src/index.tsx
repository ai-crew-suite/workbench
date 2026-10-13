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
import '@backstage/ui/css/styles.css'; // must be first import

import React from 'react';
import ReactDOM from 'react-dom/client';
import { FrontendFeature } from '@backstage/frontend-plugin-api';
import { buildDevApp } from './App';

const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

const SILENCED_PATTERNS = [
  'findDOMNode is deprecated', // Quiets the React StrictMode layout noise
  'registered as IconComponent, which is deprecated', // Quiets Backstage legacy icon registry noise
];

console.warn = (...args: any[]) => {
  const message = args.join(' ');
  if (SILENCED_PATTERNS.some(pattern => message.includes(pattern))) {
    return; // Block the warning from rendering in the developer logs
  }
  originalConsoleWarn(...args);
};

console.error = (...args: any[]) => {
  const message = args.join(' ');
  if (SILENCED_PATTERNS.some(pattern => message.includes(pattern))) {
    return; // Block the stack trace if it manifests via console.error
  }
  originalConsoleError(...args);
};

console.log('[Dev-Workbench] Shared wrapper bundle evaluated completely.');

export function bootstrapFrontendWorkbench(TargetPlugin: FrontendFeature) {
  console.log('[Dev-Workbench] bootstrapFrontendWorkbench invoked with target plugin:', TargetPlugin);

  const rootDomNode = document.getElementById('root');
  if (!rootDomNode) {
    console.error('[Dev-Workbench] CRITICAL Error: target DOM node <div id="root"></div> was not found in the document!');
    return;
  }

  try {
    const app = buildDevApp({ TargetPlugin });
    console.log('[Dev-Workbench] Backstage App Next factory constructed successfully:', app);

    const rootElement = app.createRoot();
    ReactDOM.createRoot(rootDomNode).render(
      <React.StrictMode>
        {rootElement}
      </React.StrictMode>
    );
    console.log('[Dev-Workbench] Mount process completed successfully!');
  } catch (error) {
    console.error('[Dev-Workbench] Framework initialization crashed during factory bootstrap:', error);
  }
}
