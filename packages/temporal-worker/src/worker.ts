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
// The instrumentation engine MUST be imported first before any other packages
import './instrumentation';

import { Worker } from '@temporalio/worker';
import { OpenTelemetryInboundInterceptor, OpenTelemetryOutboundInterceptor } from '@temporalio/interceptors-opentelemetry';
import * as activities from './activities';

async function runWorker() {
  const worker = await Worker.create({
    workflowsPath: require.resolve('./workflows'),
    activities,
    taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'ai-crew-tasks',

    // 3. Inject the interceptors to propagate the W3C Trace Context automatically
    interceptors: {
      // Handles tracing metadata for incoming workflow/activity requests
      workflowModules: [require.resolve('@temporalio/interceptors-opentelemetry/workflows')],
      // Handles trace state management inside the local processing worker
      activityInbound: [
        (ctx) => new OpenTelemetryInboundInterceptor(ctx),
      ],
    },
  });

  console.log('🚀 Custom Temporal Worker ignited with OTel tracing support...');
  await worker.run();
}

runWorker().catch((err) => {
  console.error('Fatal crash on worker execution loop:', err);
  process.exit(1);
});
