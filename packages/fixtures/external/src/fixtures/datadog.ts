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
import { ExternalFixtureContainer } from '../types';

export const getDatadogFixtures = (): ExternalFixtureContainer => ({
  vendorPayloads: {
    'datadog-metrics.json': {
      status: 'ok',
      series: [
        {
          metric: 'ai_crew_suite.mem0.vector_distance_precision',
          points: [
            [1787875200, 0.965],
            [1787878800, 0.942]
          ],
          type: 'gauge',
          unit: 'percentage'
        }
      ]
    },
    // INJECTED: Programmatic layout of your legacy __files/datadog-monitors.json assets
    'datadog-monitors.json': [
      {
        "id": 9876543,
        "name": "[AI-PLATFORM] Core Workflow Task Processing Latency Spike",
        "type": "query alert",
        "query": "avg(last_10m):avg:temporal.workflow.latency{environment:local-dev} > 5000",
        "message": "@pagerduty-ai-crew-suite-trigger Task execution latency has crossed critical 5000ms threshold. Ingest loop backing up.",
        "tags": ["env:local-dev", "team:platform", "engine:temporal"],
        "options": {
          "thresholds": {
            "critical": 5000.0,
            "warning": 3000.0
          },
          "notify_audit": true,
          "silenced": {}
        },
        "overall_state": "Alert",
        "priority": 1,
        "restricted_roles": null,
        "created": "2026-09-27T00:00:00.000Z",
        "modified": "2026-09-27T02:45:00.000Z"
      },
      {
        "id": 9876544,
        "name": "[MEM0-VECTOR] pgvector HNSW Index Cosine Distance Deviation",
        "type": "metric alert",
        "query": "avg(last_5m):avg:postgres.vector.distance_error{database:agentic_workflow_engine} > 0.15",
        "message": "Vector matching accuracy dropping due to stale recall indices. Schedule dynamic optimization track re-index.",
        "tags": ["env:local-dev", "team:platform", "layer:vector-db"],
        "options": {
          "thresholds": {
            "critical": 0.15,
            "warning": 0.10
          }
        },
        "overall_state": "Warn",
        "priority": 2,
        "created": "2026-09-26T14:22:10.000Z",
        "modified": "2026-09-27T01:10:05.000Z"
      },
      {
        "id": 9876545,
        "name": "[DRIVERS-GATEWAY] Third-Party API Webhook Handshake Success Rate",
        "type": "service check",
        "query": "\"datadog.agent.up\".over(\"*\").last(2).count_by_status()",
        "message": "Outbound tool driver connectivity is tracking inside healthy parameters.",
        "tags": ["env:local-dev", "team:drivers", "integration:pagerduty"],
        "options": {},
        "overall_state": "OK",
        "priority": 3,
        "created": "2026-09-20T08:00:00.000Z",
        "modified": "2026-09-27T02:55:00.000Z"
      }
    ]
  },
  wiremockMappings: [
    {
      id: 'bc1122aa-33bb-44cc-dd55-6677889900aa',
      name: 'datadog_validate_key_stub',
      request: {
        method: 'POST',
        url: '/api/v1/validate',
        // COMPILABLE: Typings now cleanly accept this validation parameter rule
        headers: {
          'Content-Type': { "equalTo": 'application/json' }
        }
      },
      response: {
        status: 200,
        body: JSON.stringify({ valid: true }),
        headers: { 'Content-Type': 'application/json' }
      }
    },
    {
      id: 'dc3344ee-55ff-66aa-bb77-889900aabbcc',
      name: 'datadog_get_active_monitors',
      request: {
        method: 'GET',
        urlPath: '/api/v1/monitor'
      },
      response: {
        status: 200,
        bodyFileName: 'datadog-monitors.json',
        headers: { 'Content-Type': 'application/json' }
      }
    }
  ]
});
