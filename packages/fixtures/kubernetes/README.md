# @ai-crew-suite/fixtures-kubernetes

This workspace package provides strongly-typed mock models of Kubernetes cluster objects (such as Namespaces, Deployments, and Pods) matching our platform services (`payment-service`, `auth-service`). It is loaded as the default Kubernetes fixtures by the Workbench CLI, removing the need to connect to an active local minikube or cloud cluster when testing Kubernetes control plane interfaces.

## 🏗️ Core Responsibilities

- **Control Plane Simulation**: Emulates responses for typical API paths like `/apis/apps/v1/namespaces/ai-crew-suite-dev/deployments`.
- **Service Mapping**: Seeds clusters with resources matching the components registered in `@ai-crew-suite/fixtures-catalog`.
- **Determinism**: Decouples the environment from active container runtimes during CI integration sweeps.

## 📈 Local Engine Maintenance

### Running Lint Sweeps

```bash
yarn turbo run lint --filter=@ai-crew-suite/fixtures-kubernetes
```

### Automated Code Style Fixing

```bash
yarn turbo run format --filter=@ai-crew-suite/fixtures-kubernetes
```

### Static Typechecking

To verify that k8s fixture parameters align with the mapping schemas, execute:

```bash
yarn turbo run typecheck --filter=@ai-crew-suite/fixtures-kubernetes
```

### Running the Test Suite

To run isolated package validation checks and ensure fixtures conform to core schemas, execute:

```bash
yarn turbo run test:unit --filter=@ai-crew-suite/fixtures-kubernetes
```

## 📄 Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.
Licensed under the **Apache License, Version 2.0**.
