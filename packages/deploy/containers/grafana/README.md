# Grafana Visualizations Hub Image

A pre-configured, production-hardened container specification providing an embedded **Grafana v13** operational metrics dashboard hub for the AI Crew Suite platform.

## 📦 Operational Role

This container provides a centralized control panel populated with pre-baked visualization dashboards mapping core system boundaries out-of-the-box.

* **Local Machine Development**: Provisions background telemetry panels on the workstation cluster network to track internal thread pool metrics and database query cycles completely offline.
* **CI/CD Automation & Playwright E2E**: Spins up inside isolated Kubernetes staging namespaces to evaluate resource starvation, Temporal queue backpressure bottlenecks, and telemetry tracking profiles automatically during automated workflows.

## 🛠 Workspace Tasks

Execute these pipeline tasks via Turborepo from the monorepo root:

### Image Compilation

```bash
yarn turbo run build --filter=@ai-crew-suite/grafana-container
```

### Static Analysis & Best Practices Linting

```bash
yarn turbo run lint --filter=@ai-crew-suite/grafana-container
```

### Declarative Structure Verification

```bash
yarn turbo run image:test:structure --filter=@ai-crew-suite/grafana-container
```

### Vulnerability Security Scanning

```bash
yarn turbo run image:test:security --filter=@ai-crew-suite/grafana-container
```

### Artifact Distribution

Publishing requires a successful structure test for the exact built image and
the current test configuration. It publishes a candidate, not `latest`. If the
engine converts the image configuration during push, publishing pulls the
result by registry digest and runs the structure test again against that
published artifact. A failed re-test leaves the candidate unapproved and
promotion is blocked:

```bash
yarn turbo run publish --filter=@ai-crew-suite/grafana-container
```

### Manual Promotion

After publishing, promote the recorded registry digest to `latest`:

```bash
yarn turbo run image:promote --filter=@ai-crew-suite/grafana-container
```

By default, publishing and promotion use the local registry at
`localhost:32443/ai-crew-suite`. Set `REGISTRY` for another registry. Promotion
works locally or in CI and requires ORAS and registry credentials where
applicable; it does not rebuild or require the local image. CI publishes
candidates but never automatically promotes them.

The build writes `.turbo/image-receipt.json` in the container workspace after
success. It records the image ID, platform, optional Turbo task hash, structure
test result, and published registry digests. To promote a CI candidate on
another machine, download the `image-receipts` workflow artifact and put the
receipt back in the corresponding container workspace using the same structure
test configuration. The receipt is local bookkeeping, not a signed attestation:
only use receipts from a trusted source. Tests and publishing require the built
image in the local Docker daemon; a receipt alone cannot restore it.
If a converted candidate already exists, it can only be reused when the receipt
records that exact publication; otherwise the command refuses to overwrite it.

Builds and tests run explicitly rather than being restored from Turbo's file
cache, which cannot restore Docker images. Docker's own layer cache still
applies. Changing `REGISTRY` for publish or promotion does not trigger a build.
The Turbo hash is an input fingerprint, not the image identity; external build
inputs must be pinned separately for reproducible builds. The current build
produces a single-platform image.

The candidate tag is derived from the image ID, but registry tags are mutable.
Configure registry-side immutability or restrict concurrent writers to enforce
candidate tag immutability; the client checks existing candidates but cannot
atomically prevent another writer from racing a push. Deploy production images
by their recorded registry digest rather than a mutable channel.

## ⚖ Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.  
Licensed under the **Apache License, Version 2.0**.
