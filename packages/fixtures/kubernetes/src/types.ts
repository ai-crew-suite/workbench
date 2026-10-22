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
export interface WiremockMapping {
  id?: string;
  name?: string;
  request: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    url?: string;
    urlPath?: string;
    queryParameters?: Record<string, { equalTo: string }>;
    headers?: Record<string, { equalTo: string } | string>;
  };
  response: {
    status: number;
    body?: string;
    bodyFileName?: string;
    headers?: Record<string, string>;
  };
}

export interface KubernetesFixtureContainer {
  resourcePayloads: Record<string, any>;
  wiremockMappings: WiremockMapping[];
}
