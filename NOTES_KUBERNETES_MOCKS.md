# Kubernetes Mocks for Backstage

## Best Practices for Local Development and Mocking

### Backend Integration / End-to-End Tests

If you are testing your custom Backstage backend modules, use a mock server context (WireMock) that responds with static Kubernetes JSON payloads.

**Your `app-config.local.yaml`:**

```yaml
kubernetes:
  serviceLocatorMethod:
    type: 'multiTenant'
  clusterLocatorMethods:
    - type: 'config'
      clusters:
        - name: mock-local-cluster
          url: http://localhost:8080 # Points to your WireMock / mock server instance
          authProvider: 'anonymous'  # Bypasses tokens entirely
          skipTLSVerify: true
          skipMetricsLookup: true
```

In your CI workflow setup:

1. Spin up a lightweight WireMock container using GitHub Actions or Docker Compose.
2. Seed it with basic Kubernetes endpoints (e.g., `/api/v1/namespaces/default/pods`).
3. Boot the Backstage backend pointing to the WireMock port using a dedicated testing configuration (`app-config.test.yaml`).

### UI & Component Tests

If you are writing unit/integration tests for your Catalog entity pages to ensure the Kubernetes tab renders and shows data, you mock the frontend API client. This requires **no YAML configuration changes** and prevents any network requests.

```typescript
import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiRegistry } from '@backstage/test-utils';
import { kubernetesApiRef } from '@backstage/plugin-kubernetes';
import { EntityKubernetesContent } from '@backstage/plugin-kubernetes';

describe('Kubernetes Catalog Tab', () => {
  it('renders mock pod data successfully', async () => {
    // 1. Define the mock data structure Backstage expects
    const mockKubernetesApi = {
      getObjectsByEntity: jest.fn().mockResolvedValue({
        items: [
          {
            cluster: { name: 'mock-ci-cluster' },
            resources: [
              {
                type: 'pods',
                object: {
                  metadata: { name: 'my-service-pod-xyz' },
                  status: { phase: 'Running' },
                  spec: { containers: [{ name: 'app' }] }
                }
              }
            ]
          }
        ]
      })
    };

    // 2. Register the mock API reference
    const apis = TestApiRegistry.from([kubernetesApiRef, mockKubernetesApi]);

    // 3. Render the component inside the Backstage test wrapper
    await renderInTestApp(<EntityKubernetesContent />, { apis });

    // 4. Assert against your mock data
    expect(await screen.findByText('my-service-pod-xyz')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
  });
});

```



### Local Ephemeral Clusters (Minikube or Kind)

Instead of mocking the plugin, developers spin up a tiny, ephemeral **local cluster manager**. This satisfies the architecture of the plugin natively without rewriting code. Set up a single-node **Minikube** or **Kind (Kubernetes in Docker)** cluster on your local machine and map its context.

1. Run a local setup script (`dev-init.sh`) that spins up Kind.
2. The script extracts the default service account token and dumps it to a local environment variable or `.env` file.
3. Backstage reads that token:

```yaml
kubernetes:
  clusterLocatorMethods:
    - type: 'config'
      clusters:
        - name: kind-cluster
          url: https://127.0.0.1:6443
          authProvider: 'serviceAccount'
          skipTLSVerify: true
          serviceAccountToken: ${K8S_KIND_TOKEN}
```
