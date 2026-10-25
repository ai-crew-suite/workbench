# Observability

## Gemini Suggestions

- Map out how the **Backstage Backend Factory** passes its trace carrier markers over to the Temporal client when spinning up workflows.
- Configure **Prometheus Alertmanager rules** to trigger logs or terminal alerts when memory thresholds exceed 90%.
- Walk through how to configure **Grafana Tempo trace-to-metrics linkages**, allowing you to jump from a slow database trace span directly into a time-correlated metric query graph.
- Do we need to define a **default `.env` file template** to accompany this layout for local fallback values?
- Should we construct an **un-privileged non-root verification check** for the backend/frontend volumes to avoid file ownership locks on the developer's host machine?

## Observability Target Stack

- **Traces (OpenTelemetry/W3C Context):** **Grafana Tempo** paired with an OpenTelemetry Collector. This lets you trace execution streams from a Backstage frontend call, down through Temporal workflow states, past `mem0` lookups, and straight into WireMock payload evaluations or pgvector index queries.
- **Metrics (Prometheus Scraping):** **Prometheus** paired with custom exporters. This handles scraping Temporal's native runtime metrics, Redis internal memory structures, and database connection pools.
- **Visualization Workspace:** **Grafana**. A single control panel to query metrics from Prometheus and traces from Tempo concurrently.

## Temporal Worker

I now have this package, how and where is it consumed?

```bash
packages/temporal-worker
├── package.json
└── src
    ├── instrumentation.ts
    └── worker.ts
```

## UI

When you spin up your environment next via your configuration setup script, Grafana will ingest these definition arrays natively at boot time. Open your browser and navigate to **`http://localhost:3000`**. Under the **Dashboards** interface navigation pane, you will find your pre-provisioned panels tracking task queue bottlenecks and Redis memory health.
