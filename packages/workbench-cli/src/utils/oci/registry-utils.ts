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
export interface TargetTags {
  localSourceTag: string;
  remoteTargetTag: string;
}

/**
 * Normalizes user-supplied or Turborepo filter strings into a clean target name.
 */
export function normalizeTargetName(target: string): string {
  return target.split('/').pop() || target;
}

/**
 * Derives fully-qualified source and target distribution tag strings.
 */
export function resolveTargetTags(targetName: string, registry: string, imageTag: string): TargetTags {
  const normalized = normalizeTargetName(targetName);
  const isLocalZot = registry.startsWith('localhost') || registry.startsWith('127.0.0.1') || registry.includes('zot');

  const remoteTargetTag = isLocalZot
    ? `${registry}/${normalized}:${imageTag}`
    : `${registry}/workbench-${normalized}:${imageTag}`;

  return {
    localSourceTag: `local/${normalized}:${imageTag}`,
    remoteTargetTag,
  };
}
