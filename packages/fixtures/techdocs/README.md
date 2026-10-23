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

## 📄 Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.
Licensed under the **Apache License, Version 2.0**.
