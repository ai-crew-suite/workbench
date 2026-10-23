# 🤖 Core Workflow Orchestration Engine Configuration

Welcome to the technical baseline documentation architecture for the `ai-crew-suite/platform` service layer.

## Operational Architecture Overview

This service hosts the master orchestration state loops powered natively by **Temporal** workflows and logs long-term agent episodic contexts directly within **Mem0** semantic tables.

### Infrastructure Dependency Array Mapping

* **State Broker Machine:** Temporal Server Engine Instance
* **Vector Math Layer:** PostgreSQL 17 with `pgvector` extension modules
* **Caching Engine:** Redis v7 Cluster Runtimes

Proceed to the [Operations Manual](operations.md) to trace local execution benchmarks.
