# Wiremock Architecture for Network Mocks

The macro interception doesn't happen at the Node.js application process layer; it happens natively inside our cluster service mesh topology.

We run a standalone **WireMock container instance** that acts as our air-gapped simulation perimeter gateway. This container is wired directly into your local orchestration stack via your root infrastructure scripts.

## How network mocks work inside `docker-compose`:

When you invoke **`yarn infra:up`**, your system boots your database alongside a containerized proxy tap:

```yaml
services:
  wiremock:
    image: wiremock/wiremock:3.9.1-alpine
    ports:
      - "8080:8080" # Binds to port 8080 on your local workstation
    volumes:
      # 1. Mounts the routing rules maps (URL paths, path matches, query hooks)
      - ./../mock-network/mappings:/home/wiremock/mappings:ro
      # 2. Mounts your unified dataset package (vendor/ directory) straight into WireMock's asset file system
      - ./../mock-fixtures:/home/wiremock/__files:ro
```

When your custom drivers send out an external call, WireMock intercepts the request, maps it against your rules, reads the file (e.g., `vendor/pagerduty-platform-incidents.json`), and echoes the telemetry dataset back to your app instantly—with absolute zero real internet exposure.

## How network mocks work inside `app-config.yaml`

To feed this proxy network smoothly without hardcoding `localhost:8080` everywhere, your code layers rely on the variable operator mappings we consolidated inside your master **`packages/app-config/app-config.yaml`** file:

```yaml
drivers:
  pagerduty:
    # Redirects runtime HTTP client endpoints dynamically
    baseUrl: ${MOCK_PROXY_URL:-http://localhost:8080}
    apiToken: mock-token-compliance-override
  datadog:
    baseUrl: ${MOCK_PROXY_URL:-http://localhost:8080}
```

For day-to-day local development, you simply boot the modern server server natively (`yarn start`). The configuration falls back to **`http://localhost:8080`**. The backend server process pushes vendor integration queries straight out to your local running compose wiremock container on port 8080.

## Headless E2E Staging Pipeline for Wiremock Network Mocks

When **`run-ci-e2e-tests.yml`** deploys an isolated preview namespace to an AWS self-hosted EKS cluster runner, your Helm upgrades inject your custom DNS string:

```bash
--set backstage.config.mockProxyUrl="http://cluster.local"
```

The value is consumed in `deploy-kubernetes/helm/backstage/templates/deployment.yaml`.

The containerized application pod receives the variable mapping, binds its internal REST drivers to the inner Kubernetes service network route, and executes high-speed Playwright browser test sweeps against the configured data seeds.

## WireMock as a Server and its Management API

WireMock runs as a fully featured HTTP server and features a rich REST API. By default, when you launch the WireMock container, it exposes a administrative control endpoint at **`http://localhost:8080/__admin`**. You can completely manage WireMock dynamically via this API at runtime without restarting the container or manually touching JSON files.

### Key Management Capabilities

- **Dynamic Stubbing:** You can POST new JSON stub mappings directly to the API.
- **Verification:** You can query WireMock to verify if an agent or plugin actually sent a specific request (critical for E2E validation assertions).
- **Recording:** You can put WireMock into "proxy mode," let it capture traffic to a real service (like Datadog), and it will automatically save those interactions as stubs.

### Example: Dynamically Injecting a Mock via HTTP POST

A consuming repository can dynamically inject a brand new API response into the active Workbench environment on the fly using a standard `curl` or a test script:

```bash
curl -X POST http://localhost:8080/__admin/mappings \
  -H "Content-Type: application/json" \
  -d '{
    "request": {
      "method": "GET",
      "url": "/api/v1/agents/status"
    },
    "response": {
      "status": 200,
      "jsonBody": { "agent": "active", "workflow": "optimized" },
      "headers": { "Content-Type": "application/json" }
    }
  }'
```

This enables an integration workflow where an agent test suite can programmatically set up its own network state dependencies before running its validation passes, then tear them down afterward using `POST /__admin/mappings/reset`.
