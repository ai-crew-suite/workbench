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
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

// 1. Establish the Trace Collector Endpoint mapping to the OTel container gateway
const traceExporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
});

// 2. Instantiate the Runtime Node Trace Compiler Engine
const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: 'temporal-worker-crew',
    [ATTR_SERVICE_VERSION]: '1.0.0',
  }),
  traceExporter: traceExporter,
});

// Start checking executions and listening to pipeline channels
sdk.start();

// Ensure clean flush updates when container loop sigterm traps fire
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Telemetry shutdown finalized.'))
    .catch((error) => console.error('Telemetry teardown failed:', error))
    .finally(() => process.exit(0));
});
