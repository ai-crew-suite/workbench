import math
import os
from copy import deepcopy


def configure_from_environment(config):
    """Apply explicitly configured startup providers after persisted overrides."""
    config = deepcopy(config)
    for role, variable, model_variable, defaults in (
        ("llm", "MEM0_LLM_PROVIDER", "MEM0_LLM_MODEL",
         {"openai": "gpt-4o-mini", "ollama": "llama3.1"}),
        ("embedder", "MEM0_EMBEDDER_PROVIDER", "MEM0_EMBEDDER_MODEL",
         {"openai": "text-embedding-3-small", "ollama": "nomic-embed-text"}),
    ):
        provider = os.environ.get(variable)
        if not provider and os.environ.get(model_variable):
            provider = config[role]["provider"]
        if not provider:
            continue
        if provider not in defaults:
            raise ValueError(f"{variable} must be openai or ollama, got {provider!r}")

        current = config[role]
        settings = current["config"] if current["provider"] == provider else {}
        settings["model"] = os.environ.get(model_variable) or (
            settings.get("model") if current["provider"] == provider else None
        ) or defaults[provider]
        if provider == "ollama":
            settings.pop("api_key", None)
            settings["ollama_base_url"] = os.environ.get("OLLAMA_BASE_URL") or "http://host.docker.internal:11434"
        else:
            settings.pop("ollama_base_url", None)
            if os.environ.get("OPENAI_API_KEY"):
                settings["api_key"] = os.environ["OPENAI_API_KEY"]
        config[role] = {"provider": provider, "config": settings}

    llm_config = config["llm"]["config"]
    temperature = os.environ.get("MEM0_LLM_TEMPERATURE")
    if temperature:
        value = float(temperature)
        if not math.isfinite(value):
            raise ValueError("MEM0_LLM_TEMPERATURE must be finite")
        llm_config["temperature"] = value
    max_tokens = os.environ.get("MEM0_LLM_MAX_TOKENS")
    if max_tokens:
        value = int(max_tokens)
        if value <= 0:
            raise ValueError("MEM0_LLM_MAX_TOKENS must be positive")
        llm_config["max_tokens"] = value

    dimensions = os.environ.get("MEM0_EMBEDDING_DIMENSIONS")
    if config["embedder"]["provider"] == "ollama" and not dimensions:
        if not os.environ.get("MEM0_EMBEDDER_PROVIDER"):
            dimensions = config["vector_store"]["config"].get("embedding_model_dims")
        if not dimensions:
            raise ValueError("MEM0_EMBEDDING_DIMENSIONS is required for an Ollama embedder")
    if dimensions:
        value = int(dimensions)
        if not 1 <= value <= 16000:
            raise ValueError("MEM0_EMBEDDING_DIMENSIONS must be between 1 and 16000")
        config["vector_store"]["config"]["embedding_model_dims"] = value
        config["embedder"]["config"]["embedding_dims"] = value
        if value > 2000:
            config["vector_store"]["config"]["hnsw"] = False

    collection = os.environ.get("POSTGRES_COLLECTION_NAME")
    if collection:
        config["vector_store"]["config"]["collection_name"] = collection
    return config
