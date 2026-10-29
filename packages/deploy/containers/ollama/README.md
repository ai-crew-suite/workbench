# Ollama Core Runtime Engine

A specialized, local inference execution container specification utilizing **Ollama** to provide high-performance Large Language Model (LLM) and embedding capabilities completely offline for the AI Crew Suite platform.

## 📦 Operational Role

This container acts as the local intelligence and text vectorization engine, processing natural language prompts, managing conversational state histories, and computing vector mathematical arrays entirely on workstation hardware.

- **Local Machine Development**: Provisions ultra-lightweight text processing and embedding nodes on the workstation network to drive agentic loops, function calling steps, and semantic memory lookup tables without third-party cloud API costs.
- **CI/CD Automation & E2E Validation**: Launches inside isolated testing namespaces during integration testing sweeps to verify structured JSON parser output reliability, execution guardrail constraints, and tool-calling logic matrices.

## 🧠 Baked-In Testing & Inference Models

  To maximize token generation speed and eliminate cold-start lag during test execution cycles, this container includes a pre-baked model layer optimized for strict RAM-only hosting environments.

| Model Reference | Footprint (RAM) | Primary Architecture Intent |
| --- | --- | --- |
| **`llama3.2` (3B)** | ~2.5 GB – 3.0 GB | Standard agent logic routing, tool/function calling evaluation, and complex multi-turn reasoning steps. |
| **`bge-m3`** | ~1.2 GB | Multi-functional text vectorization and dense retrieval mappings for the Mem0 long-term memory engine. |
| **`llama-guard3:1b`** | ~1.2 GB – 1.5 GB | High-speed structural input validation, jailbreak protection, and output safety classification gating. |

The image build downloads these models using an isolated Ollama server and
verifies their manifests in `OLLAMA_MODELS`. A successful build requires network
access to the model registry and sufficient disk space. Structure tests inspect
the image itself, not the models installed on the host. Rebuild the image after
changing the Dockerfile or preload script before running the structure tests.

## 🛠 Workspace Tasks

Execute these pipeline tasks via Turborepo from the monorepo root:

### Image Compilation

```bash
yarn turbo run build --filter=@ai-crew-suite/ollama-container
```

### Static Analysis & Best Practices Linting

```bash
yarn turbo run lint --filter=@ai-crew-suite/ollama-container
```

### Declarative Structure Verification

```bash
yarn turbo run image:test:structure --filter=@ai-crew-suite/ollama-container
```

### Vulnerability Security Scanning

```bash
yarn turbo run image:test:security --filter=@ai-crew-suite/ollama-container
```

### Integration Smoke Testing

```bash
yarn turbo run image:test:unit --filter=@ai-crew-suite/ollama-container
```

### Artifact Distribution

```bash
yarn turbo run publish --filter=@ai-crew-suite/ollama-container
```

## ⚖ Compliance and Licensing

Copyright © 2026 The AI Crew Suite Authors.  
Licensed under the **Apache License, Version 2.0**.
