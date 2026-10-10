# `@ai-crew-suite/deploy-terraform`

🏗️ Production Infrastructure-as-Code (IaC) blueprints and managed cloud service topologies for the AI Crew Suite platform.

## Overview

This workspace package manages the declarative multi-region cloud topology infrastructure models for the AI Crew Suite platform. Built natively using **HashiCorp Terraform**, this configuration automates the provisioning of secure network perimeters (VPCs), immutable container registries (ECR), fully managed relational vector engines (AWS RDS PostgreSQL with `pgvector`), and clustered caching architectures (AWS ElastiCache Redis) required to sustain our production scale.

## Core Responsibilities

- **VPC Isolation Controls**: Automates the compilation of multi-Availability Zone subnets and routing boundaries to implement strict network perimeter filtering.
- **Vector Cluster Provisioning**: Instantiates managed database nodes mapped directly to the technical version limits required by Backstage schemas and Mem0 semantic workflows.
- **Sensitive Variable Shielding**: Leverages secure compilation parameters to enforce strict token masking, ensuring master structural database passwords never bleed into automated build logs.

## Architectural Dependency Tree

This IaC module governs the physical cloud footprint that hosts our live orchestration networks:

- **Upstream Providers**: Governed by the official HashiCorp AWS provider registry systems (`~> 5.0`).
- **Downstream Consumers**: Evaluated by automated CI/CD runners during pull request review lifecycles to predict infrastructure modifications before environment application steps.
- **Boundary Rule**: This package is dedicated to structural resource definitions only. Always maintain private local authentication credentials separate from code via local variable scopes or secure shell exports.

## Local Development Workflow

Workspace Initialization

To download target cloud provider plugins, build internal lock files, and initialize your local configuration workspace from the monorepo root, execute:

```bash
yarn tf:init
```

### Static Configuration Validation

To run quick validation syntax checks locally and verify your infrastructure blocks pass schema rules without querying live cloud endpoints, run:

```bash
yarn tf:validate
```

### Simulating Cloud State Plans

To execute a non-interactive dry-run evaluation pass and inspect the exact modifications Terraform plans to commit to your cloud cluster, run:

```bash
yarn tf:plan
```

## Consumer Integration Checklist

To bypass manual keyboard input prompts on your local dev machine, populate a local properties variable file:

### Inject Local Workstation Variables

Create a local variable override file inside this workspace directory to automatically answer mandatory input fields. This file is pre-configured to be safely blocked by our project `.gitignore` patterns:

```hcl
# packages/deploy-terraform/terraform.tfvars
database_secure_password = "your_local_sandbox_password_string_123"
```

### Infrastructure Schema Configuration Matrix

Ensure your structural IaC workspace maintains these verified file assets:

- **`main.tf`**: The primary blueprint manifest defining VPC networks, container registries, managed PostgreSQL databases, and Redis clusters.
- **`variables.tf`**: Invariant typing declaration schemas enforcing data type safety across deployment environment stages.
- **`package.json`**: Sub-package execution scripts mapping raw Terraform parameters directly to standard, cross-platform Yarn task paths.

## Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.
Licensed under the **Apache License, Version 2.0**.