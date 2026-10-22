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
import { getDatadogFixtures } from './fixtures/datadog';
import { getPagerDutyFixtures } from './fixtures/pagerduty';
import { WiremockMapping } from './types';

export type { WiremockMapping, ExternalFixtureContainer } from './types';

/**
 * Aggregates all programmatic Wiremock structural mapping templates across vendors.
 */
export const getAllProgrammaticMappings = (): WiremockMapping[] => {
  return [
    ...getDatadogFixtures().wiremockMappings,
    ...getPagerDutyFixtures().wiremockMappings
  ];
};

/**
 * Aggregates all standalone vendor telemetry/incident json payloads across vendors.
 */
export const getAllProgrammaticVendorPayloads = (): Record<string, any> => {
  return {
    ...getDatadogFixtures().vendorPayloads,
    ...getPagerDutyFixtures().vendorPayloads
  };
};
