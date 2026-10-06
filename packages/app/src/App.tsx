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
import { createApp } from '@backstage/frontend-defaults';
import type { FrontendFeature } from '@backstage/frontend-plugin-api';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import notificationsPlugin from '@backstage/plugin-notifications/alpha';
import searchPlugin from '@backstage/plugin-search/alpha';
import kubernetesAiResponderPlugin from '@ai-crew-suite/plugin-agent-kubernetes-responder/alpha';
import oncallHandoverPlugin from '@ai-crew-suite/plugin-agent-oncall-handover/alpha';
import releaseNotesPlugin from '@ai-crew-suite/plugin-agent-release-notes-generator/alpha';
import alertAiTunerPlugin from '@ai-crew-suite/plugin-agent-alert-tuner-backend/alpha';
import driftDetectorPlugin from '@ai-crew-suite/plugin-agent-scaffolder-drift-detector/alpha';
import scaffolderGuardrailPlugin from '@ai-crew-suite/plugin-agent-scaffolder-guardrail/alpha';
import scaffolderInfraPlugin from '@ai-crew-suite/plugin-agent-scaffolder-infra/alpha';
import scaffolderIntentPlugin from '@ai-crew-suite/plugin-agent-scaffolder-intent/alpha';
import shadowDetectivePlugin from '@ai-crew-suite/plugin-agent-scaffolder-shadow-detective/alpha';
import scaffolderPrdPlugin from '@ai-crew-suite/plugin-agent-scaffolder-prd/alpha';
import catalogAiInsightsPlugin from '@ai-crew-suite/plugin-agent-catalog-insights/alpha';
import rfcAdrReviewerPlugin from '@ai-crew-suite/plugin-agent-rfc-adr-reviewer/alpha';
import searchArcheologyPlugin from '@ai-crew-suite/plugin-agent-search-archeology/alpha';
import searchContextPlugin from '@ai-crew-suite/plugin-agent-search-context/alpha';
import techDebtScoutPlugin from '@ai-crew-suite/plugin-agent-tech-debt-scout/alpha';
import techRadarPlugin from '@ai-crew-suite/plugin-agent-tech-radar-manager/alpha';
import techdocsJanitorPlugin from '@ai-crew-suite/plugin-agent-techdocs-janitor/alpha';
import techdocsPostmortemPlugin from '@ai-crew-suite/plugin-agent-techdocs-postmortem/alpha';
import { navModule } from './modules/nav';

const features: FrontendFeature[] = [
  catalogPlugin as FrontendFeature,
  notificationsPlugin as FrontendFeature,
  searchPlugin as FrontendFeature,
  navModule as FrontendFeature,
  kubernetesAiResponderPlugin,
  oncallHandoverPlugin,
  releaseNotesPlugin,
  catalogAiInsightsPlugin,
  alertAiTunerPlugin,
  driftDetectorPlugin,
  scaffolderGuardrailPlugin,
  scaffolderInfraPlugin,
  scaffolderIntentPlugin,
  shadowDetectivePlugin,
  scaffolderPrdPlugin,
  rfcAdrReviewerPlugin,
  searchArcheologyPlugin,
  searchContextPlugin,
  techDebtScoutPlugin,
  techRadarPlugin,
  techdocsJanitorPlugin,
  techdocsPostmortemPlugin,
];

const app = createApp({
  features,
});

export default app.createRoot();
