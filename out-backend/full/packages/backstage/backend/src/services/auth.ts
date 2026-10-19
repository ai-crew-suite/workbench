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
import { createServiceFactory, coreServices } from '@backstage/backend-plugin-api';

/**
 * Global Dev Sandbox Authentication Bypass
 */
const devSandboxHttpAuthServiceFactory = createServiceFactory({
  service: coreServices.httpAuth,
  deps: {},
  async factory() {
    return {
      async credentials(_ctx: unknown, _options: unknown) {
        return {
          type: 'user',
          principal: {
            type: 'user',
            userEntityRef: 'user:default/guest',
            ownershipEntityRefs: ['user:default/guest', 'group:default/developers'],
          },
        };
      },
      isPrincipal(credentials: unknown, principalType: unknown) {
        return (credentials as any)?.type === principalType;
      },
    } as any;
  },
});

/**
 * Global User Info Mock Bypass
 */
const devSandboxUserInfoServiceFactory = createServiceFactory({
  service: coreServices.userInfo,
  deps: {},
  async factory() {
    return {
      async getUserInfo(_credentials) {
        return {
          userEntityRef: 'user:default/guest',
          ownershipEntityRefs: ['user:default/guest', 'group:default/developers'],
          metadata: {
            displayName: 'Dev Guest User',
            email: 'developer@ai-crew-suite.local',
          },
        };
      },
    };
  },
});

/**
 * Global Dev Sandbox Auth Service Bypass
 */
const devSandboxAuthServiceFactory = createServiceFactory({
  service: coreServices.auth,
  deps: {},
  async factory() {
    const serviceCredentials = {
      $$type: '@backstage/BackstageCredentials',
      version: 'v1',
      principal: { type: 'service', subject: 'dev-sandbox' },
    };
    const guestUserCredentials = {
      $$type: '@backstage/BackstageCredentials',
      version: 'v1',
      principal: {
        type: 'user',
        userEntityRef: 'user:default/guest',
        ownershipEntityRefs: ['user:default/guest', 'group:default/developers'],
      },
    };
    return {
      async authenticate(_token: string) {
        return guestUserCredentials;
      },
      async isPrincipal(credentials: unknown, principalType: string) {
        return (credentials as any)?.principal?.type === principalType;
      },
      async getNoneCredentials() {
        return {
          $$type: '@backstage/BackstageCredentials',
          version: 'v1',
          principal: { type: 'none' },
        };
      },
      async getOwnServiceCredentials() {
        return serviceCredentials;
      },
      async getPluginRequestToken(_options: unknown) {
        return { token: 'dev-sandbox-plugin-token' };
      },
      async getLimitedUserToken(_credentials: unknown) {
        return {
          token: 'dev-sandbox-limited-user-token',
          expiresAt: new Date(Date.now() + 3_600_000),
        };
      },
      async listPublicServiceKeys() {
        return { keys: [] };
      },
    } as any;
  },
});

export const devSandboxAuthServices = [
  devSandboxHttpAuthServiceFactory,
  devSandboxUserInfoServiceFactory,
  devSandboxAuthServiceFactory,
];
