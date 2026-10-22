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

export const getPagerDutyFixtures = (): ExternalFixtureContainer => ({
  vendorPayloads: {
    'pagerduty-incidents.json': {
      incidents: [
        {
          id: 'INC-0042-LEAK',
          incident_number: 42,
          title: '🚨 Prompt Injection Vector Leak - Cognitive Routing Network',
          status: 'triggered',
          created_at: '2026-09-28T00:00:00Z',
          urgency: 'high',
          service: {
            id: 'SRV-PLATFORM',
            summary: 'ai-crew-suite/platform'
          },
          assignments: [
            {
              assignee: {
                id: 'USR-KEVIN',
                summary: 'Kevin (Platform Team)'
              }
            }
          ]
        }
      ]
    }
  },
  wiremockMappings: [
    {
      id: '418e223c-f4b6-4b8c-9051-7fef12345678',
      name: 'pagerduty_list_incidents_stub',
      request: {
        method: 'GET',
        url: '/incidents'
      },
      response: {
        status: 200,
        body: JSON.stringify({
          incidents: [
            {
              id: 'P123',
              status: 'triggered',
              title: '[AI-FAULT] Agentic Feedback Loop Recurrence Limit Exceeded',
              created_at: '2026-09-27T12:00:00Z',
              urgency: 'high',
              service: {
                summary: 'temporal-orchestration-engine'
              }
            }
          ]
        }),
        headers: { 'Content-Type': 'application/json' }
      }
    },
    {
      request: {
        method: 'GET',
        urlPath: '/api/v1/incidents',
        queryParameters: {
          'service_ids[]': {
            equalTo: 'SRV-AGENTS'
          }
        }
      },
      response: {
        status: 200,
        bodyFileName: 'vendor/pagerduty-agents-incidents.json',
        headers: { 'Content-Type': 'application/json' }
      }
    }
  ]
});
