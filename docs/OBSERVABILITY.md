# Observability

Because your architecture orchestrates complex state, memory, and vector operations via **Temporal, Mem0, and pgvector**, a generic application log isn't enough. We need to plan a multi-runtime telemetry strategy (Metrics, Logs, and Tracing) that keeps your local Dev Server Factory lightweight but fully observable.

## Temporal (Orchestration & Workflow Telemetry)

Temporal is inherently stateful and noisy. The goal is to track workflow execution health, scheduling latency, and activity timeouts without tanking local developer loop performance.

Temporal emits metrics by default in a format that is supported by Prometheus. Any metrics software that supports the same format can be used. Currently, we test with the following Prometheus and Grafana versions:

- **Prometheus >= v2.0**
- **Grafana >= v2.5**

### Metrics (Prometheus/OpenTelemetry)

- Expose the Temporal SDK metrics endpoint from your Backstage backend worker package.
- **Key Signals to Monitor:** `workflow_failed`, `workflow_continue_as_new_suggested`, `activity_schedule_to_start_latency` (critical for catching starved local worker threads), and `workflow_end_to_end_latency`.

### Tracing (W3C Trace Context Propagation)

- Configure the Temporal OpenTelemetry Tracing Interceptor on both your Workflows and Activities.
- This ensures that when a Backstage Scaffolder Template triggers a Temporal workflow, the Trace ID propagates cleanly across the boundary, showing up as a unified timeline.

### Logging

- Suppress standard Temporal polling noise (`Workflow task processed`) to `DEBUG` or `TRACE` levels.
- Route `WARN` and `ERROR` states directly into your Local Dev Server’s ANSI error isolation pipeline.

## Mem0 (Long-Term AI Memory Telemetry)

Since Mem0 handles semantic memory layers, user context, and episodic updates, your observability must focus on graph/vector updates and retrieval latencies.

### Metrics

- Track request execution times for memory addition, search, and deletion (`mem0.api.request.duration`).
- Track cache hit/miss ratios if you have an extraction or serialization layer sitting in front of the memory graph.

### Tracing

- Inject custom OpenTelemetry spans around Mem0 `add()`, `search()`, and `get_all()` operations.
- This lets developers visualize exactly how much overhead the "memory recall" step adds to an AI agent's overall execution loop.

### Logging

- Log sanitized metadata changes (e.g., `"Memory updated for User X - 1 token added, 0 keys modified"`) without logging raw PII or sensitive prompt data to the local terminal.

## pgvector (Vector Database & Semantic Search Performance)

Your PostgreSQL instance pulling double duty as a relational DB and a vector store means monitoring index efficiency and query cost.

### Metrics (via `postgres_exporter` or direct SQL telemetry hooks)

- Monitor HNSW or IVFFlat index build performance and cache hits.
- **Key Query Signals:** Track the execution duration of cosine similarity (`<=>`) or inner product (`<#>`) operators.

### Tracing

- Ensure your database client (e.g., Knex or Prisma inside Backstage) uses an OpenTelemetry auto-instrumentation plugin.
- This surfaces slow vector similarity queries as deep-nested child spans directly beneath the Mem0 or Temporal parent traces.

### Logging

- Leverage Postgres `auto_explain` logs in your `customDatabaseServiceFactory` for local development. Set a low threshold (e.g., any query taking >100ms) to dump query execution plans straight to the container logs if an un-indexed vector scan occurs.

## Redis

