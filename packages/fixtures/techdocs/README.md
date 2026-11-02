# Mock Techdocs Fixtures

This package provides a default set of Techdocs documentation for the AI Crew Suite backend dev server. It packages source Markdown documents alongside pre-compiled HTML layouts and clientside full-text search indexes, allowing sandbox environments to serve realistic documentation tabs seamlessly for development and testing against a predictable baseline.

## Local Development Workflow

To initialize the monorepo workspace dependencies, run the following from the root directory:

```bash
yarn install
```

### Executing Static Data Lint Sweeps

To evaluate the static TypeScript configurations against our workspace lint guidelines, execute:

```bash
yarn turbo run lint --filter=@ai-crew-suite/fixtures-techdocs
```

### Automated Code Style Fixing

To automatically fix formatting errors, trailing spaces, or indentation variations inside your mock assets instantly, run:

```bash
yarn turbo run format --filter=@ai-crew-suite/fixtures-techdocs
```

### Typecheck

To typecheck code, run:

```bash
yarn turbo run typecheck --filter=@ai-crew-suite/fixtures-techdocs
```

### Running the Test Suite

To run isolated package validation checks and ensure entities conform to core schemas, execute:

```bash
yarn turbo run test:unit --filter=@ai-crew-suite/fixtures-techdocs
```

### Cleaning Old Compilation Build Arrays

To wipe away legacy JavaScript modules and stale HTML asset caches, run:

```bash
yarn turbo run clean --filter=@ai-crew-suite/fixtures-techdocs
```

### Executing Unified Blueprint Compilation

To trigger parallel compilation tasks (TypeScript code compilation and the underlying `techdocs-cli` wrapper compiler), run:

```bash
yarn turbo run build --filter=@ai-crew-suite/fixtures-techdocs
```

To build only the documentation, run:

```bash
yarn turbo run build:techdocs --filter=@ai-crew-suite/fixtures-techdocs
```

The build requires the Docker CLI and an accessible Docker-compatible engine.
It uses `spotify/techdocs:latest` to run MkDocs and writes the generated site
to `static-compiled/default/component/platform`. The TechDocs CLI prepares a
temporary copy of the source, so its MkDocs configuration changes do not modify
the checked-in files. Previous output is retained if generation fails.

The container runs as its default user on rootless engines, where that user maps
to the host user, and as the current UID and GID on rootful engines. MkDocs is
run through the Docker CLI to avoid an intermittent Podman auto-removal race in
the TechDocs CLI's Docker runner. The selected Docker context or `DOCKER_HOST`
still controls which engine is used.

## 📄 Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.
Licensed under the **Apache License, Version 2.0**.
