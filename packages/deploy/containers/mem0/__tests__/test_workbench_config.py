import importlib.util
import os
from pathlib import Path
import unittest
from unittest.mock import patch


SOURCE = Path(__file__).resolve().parents[1] / "src" / "workbench_config.py"
spec = importlib.util.spec_from_file_location("workbench_config", SOURCE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def baseline():
    return {
        "vector_store": {
            "provider": "pgvector",
            "config": {"collection_name": "memories"},
        },
        "llm": {"provider": "openai", "config": {"model": "gpt-4o-mini", "api_key": "old-key", "temperature": 0.2}},
        "embedder": {"provider": "openai", "config": {"model": "text-embedding-3-small", "api_key": "old-key"}},
        "history_db_path": "/app/history.db",
    }


class ConfigTests(unittest.TestCase):
    def configure(self, config, **env):
        with patch.dict(os.environ, env, clear=True):
            return module.configure_from_environment(config)

    def test_no_environment_preserves_persisted_configuration(self):
        config = baseline()
        result = self.configure(config)
        self.assertEqual(result, config)
        self.assertIsNot(result, config)

    def test_ollama_overrides_persisted_openai_and_sets_vector_shape(self):
        config = baseline()
        result = self.configure(
            config,
            MEM0_LLM_PROVIDER="ollama",
            MEM0_LLM_MODEL="llama3.3:latest",
            MEM0_LLM_TEMPERATURE="0.1",
            MEM0_LLM_MAX_TOKENS="2000",
            MEM0_EMBEDDER_PROVIDER="ollama",
            MEM0_EMBEDDER_MODEL="qwen3-embedding:8b",
            MEM0_EMBEDDING_DIMENSIONS="4096",
            OLLAMA_BASE_URL="http://host.docker.internal:11434",
            POSTGRES_COLLECTION_NAME="memories_ollama_qwen3_8b",
        )
        self.assertEqual(result["llm"], {
            "provider": "ollama",
            "config": {
                "model": "llama3.3:latest",
                "temperature": 0.1,
                "max_tokens": 2000,
                "ollama_base_url": "http://host.docker.internal:11434",
            },
        })
        self.assertEqual(result["embedder"]["provider"], "ollama")
        self.assertEqual(result["embedder"]["config"], {
            "model": "qwen3-embedding:8b",
            "embedding_dims": 4096,
            "ollama_base_url": "http://host.docker.internal:11434",
        })
        self.assertEqual(result["vector_store"]["config"], {
            "collection_name": "memories_ollama_qwen3_8b",
            "embedding_model_dims": 4096,
            "hnsw": False,
        })
        self.assertEqual(config, baseline())

    def test_openai_remains_supported_after_ollama(self):
        config = baseline()
        config["llm"] = {"provider": "ollama", "config": {"model": "llama", "ollama_base_url": "http://ollama:11434"}}
        config["embedder"] = {"provider": "ollama", "config": {"model": "embed", "ollama_base_url": "http://ollama:11434"}}
        result = self.configure(
            config,
            MEM0_LLM_PROVIDER="openai",
            MEM0_EMBEDDER_PROVIDER="openai",
            OPENAI_API_KEY="test-key",
        )
        self.assertEqual(result["llm"]["config"], {"model": "gpt-4o-mini", "api_key": "test-key"})
        self.assertEqual(result["embedder"]["config"], {"model": "text-embedding-3-small", "api_key": "test-key"})

    def test_models_can_be_set_without_provider_overrides(self):
        result = self.configure(
            baseline(),
            MEM0_LLM_MODEL="custom-llm",
            MEM0_EMBEDDER_MODEL="custom-embedding",
        )
        self.assertEqual(result["llm"]["config"]["model"], "custom-llm")
        self.assertEqual(result["embedder"]["config"]["model"], "custom-embedding")

    def test_mixed_providers_and_small_embedding_keep_hnsw(self):
        result = self.configure(
            baseline(),
            MEM0_LLM_PROVIDER="openai",
            MEM0_EMBEDDER_PROVIDER="ollama",
            MEM0_EMBEDDING_DIMENSIONS="768",
        )
        self.assertEqual(result["llm"]["provider"], "openai")
        self.assertEqual(result["embedder"]["config"]["ollama_base_url"], "http://host.docker.internal:11434")
        self.assertNotIn("hnsw", result["vector_store"]["config"])

    def test_persisted_ollama_dimensions_without_provider_environment(self):
        config = baseline()
        config["embedder"] = {"provider": "ollama", "config": {"model": "embed"}}
        config["vector_store"]["config"]["embedding_model_dims"] = 4096
        result = self.configure(config)
        self.assertEqual(result["embedder"]["config"]["embedding_dims"], 4096)
        self.assertFalse(result["vector_store"]["config"]["hnsw"])

    def test_invalid_configuration_fails_explicitly(self):
        for env in (
            {"MEM0_LLM_PROVIDER": "bad"},
            {"MEM0_EMBEDDER_PROVIDER": "ollama"},
            {"MEM0_EMBEDDING_DIMENSIONS": "0"},
            {"MEM0_EMBEDDING_DIMENSIONS": "16001"},
            {"MEM0_EMBEDDING_DIMENSIONS": "bad"},
            {"MEM0_LLM_MAX_TOKENS": "0"},
            {"MEM0_LLM_TEMPERATURE": "nan"},
        ):
            with self.subTest(env=env), self.assertRaises(ValueError):
                self.configure(baseline(), **env)


if __name__ == "__main__":
    unittest.main()
