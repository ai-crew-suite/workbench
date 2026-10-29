import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[4]
COMPOSE = ROOT / "packages" / "deploy" / "compose" / "src" / "compose.yml"


class ComposeConfigTests(unittest.TestCase):
    def config(self, env_file, **overrides):
        env = {key: os.environ[key] for key in ("HOME", "PATH", "DOCKER_CONFIG") if key in os.environ}
        env.update(overrides)
        result = subprocess.run(
            ["docker", "compose", "--env-file", str(env_file), "-f", str(COMPOSE),
             "config", "--format", "json"],
            cwd=ROOT,
            env=env,
            text=True,
            capture_output=True,
            check=True,
        )
        return json.loads(result.stdout)["services"]

    def test_default_network_and_image_wiring(self):
        with tempfile.TemporaryDirectory() as directory:
            empty_env = Path(directory) / "empty.env"
            empty_env.touch()
            services = self.config(empty_env)

        ollama = services["ollama"]
        mem0 = services["mem0"]
        self.assertEqual(ollama["image"], "local/ollama-container:latest")
        self.assertEqual(ollama["environment"]["OLLAMA_HOST"], "0.0.0.0:11434")
        self.assertNotIn("ports", ollama)
        self.assertNotIn("volumes", ollama)
        self.assertIn("ollama list", " ".join(ollama["healthcheck"]["test"]))
        self.assertEqual(mem0["depends_on"]["ollama"]["condition"], "service_healthy")
        self.assertEqual(mem0["depends_on"]["pgvector"]["condition"], "service_healthy")
        self.assertEqual(mem0["environment"]["OLLAMA_BASE_URL"], "http://ollama:11434")

    def test_example_models_match_image_and_embedding_dimensions(self):
        services = self.config(ROOT / ".env.example")
        env = services["mem0"]["environment"]
        self.assertEqual(env["MEM0_LLM_PROVIDER"], "ollama")
        self.assertEqual(env["MEM0_LLM_MODEL"], "llama3.2:latest")
        self.assertEqual(env["MEM0_EMBEDDER_PROVIDER"], "ollama")
        self.assertEqual(env["MEM0_EMBEDDER_MODEL"], "bge-m3:latest")
        self.assertEqual(env["MEM0_EMBEDDING_DIMENSIONS"], "1024")
        self.assertEqual(env["POSTGRES_COLLECTION_NAME"], "memories_ollama_bge_m3")
        self.assertEqual(env["OLLAMA_BASE_URL"], "http://ollama:11434")

    def test_image_and_endpoint_can_be_overridden(self):
        services = self.config(
            ROOT / ".env.example",
            OLLAMA_IMAGE_REPOSITORY="registry.example/ollama-container",
            IMAGE_TAG="test",
            OLLAMA_BASE_URL="http://host.docker.internal:11434",
        )
        self.assertEqual(services["ollama"]["image"], "registry.example/ollama-container:test")
        self.assertEqual(
            services["mem0"]["environment"]["OLLAMA_BASE_URL"],
            "http://host.docker.internal:11434",
        )


if __name__ == "__main__":
    unittest.main()
