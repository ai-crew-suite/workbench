import json
from pathlib import Path
import subprocess
import tempfile
import unittest


DEPLOY = Path(__file__).resolve().parents[2]
TEMPORAL = DEPLOY / "containers" / "temporal" / "src"
MEM0 = DEPLOY / "containers" / "mem0" / "src"

STUB = """#!/usr/bin/env python3
import json, os, pathlib, sys
name = pathlib.Path(sys.argv[0]).name
with open(os.environ["CALL_LOG"], "a") as log:
    log.write(json.dumps([name, *sys.argv[1:]]) + "\\n")
if name == "psql" and "--command" in sys.argv:
    print(os.environ.get("SCHEMA_INITIALIZED", "f"))
if name == os.environ.get("FAIL_COMMAND"):
    sys.exit(1)
"""


class EntrypointTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bin = self.root / "bin"
        self.bin.mkdir()
        for name in ("nc", "psql", "temporal-sql-tool", "temporal-server", "alembic", "uvicorn"):
            stub = self.bin / name
            stub.write_text(STUB)
            stub.chmod(0o755)
        self.log = self.root / "calls"
        self.env = {
            "PATH": f"{self.bin}:/usr/bin:/bin",
            "CALL_LOG": str(self.log),
            "POSTGRES_DB": "workbench",
            "POSTGRES_HOST": "db",
            "POSTGRES_PASSWORD": 'a"$: #\\password',
            "POSTGRES_USER": "user",
        }

    def calls(self):
        return [json.loads(line) for line in self.log.read_text().splitlines()]

    def temporal(self, **env):
        config = self.root / "config"
        config.mkdir(exist_ok=True)
        (config / "config.yaml").write_text((TEMPORAL / "config.yaml").read_text())
        script = (TEMPORAL / "entrypoint.sh").read_text().replace("/etc/temporal", str(self.root))
        return subprocess.run(
            ["bash", "-c", script],
            env={**self.env, **env},
            text=True,
            capture_output=True,
            check=False,
        )

    def mem0(self, **env):
        server = self.root / "server"
        server.mkdir(exist_ok=True)
        script = (MEM0 / "entrypoint.sh").read_text().replace("/app/server", str(server))
        return subprocess.run(
            ["bash", "-c", script],
            env={**self.env, **env},
            text=True,
            capture_output=True,
            check=False,
        )

    def test_temporal_initializes_both_stores_and_renders_credentials(self):
        result = self.temporal()
        self.assertEqual(result.returncode, 0, result.stderr)
        calls = self.calls()
        migrations = [call for call in calls if call[0] == "temporal-sql-tool"]
        self.assertEqual(len(migrations), 4)
        self.assertEqual([call[call.index("--database") + 1] for call in migrations],
                         ["workbench", "workbench", "temporal_visibility", "temporal_visibility"])
        self.assertTrue(all(call[call.index("--plugin") + 1] == "postgres12" for call in migrations))
        self.assertTrue(any("postgresql/v12/visibility/versioned" in call[-1] for call in migrations))
        rendered = (self.root / "config" / "development.yaml").read_text()
        self.assertIn(f"password: {json.dumps(self.env['POSTGRES_PASSWORD'])}", rendered)
        self.assertIn("datastores:", rendered)
        self.assertNotIn("${", rendered)
        self.assertEqual(calls[-1], ["temporal-server", "--root", str(self.root), "--config", "config", "--env", "development", "start"])

    def test_temporal_restart_skips_setup_but_updates_both_stores(self):
        result = self.temporal(SCHEMA_INITIALIZED="t")
        self.assertEqual(result.returncode, 0, result.stderr)
        migrations = [call for call in self.calls() if call[0] == "temporal-sql-tool"]
        self.assertEqual(len(migrations), 2)
        self.assertTrue(all("update-schema" in call for call in migrations))

    def test_temporal_stops_when_schema_migration_fails(self):
        result = self.temporal(FAIL_COMMAND="temporal-sql-tool")
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(any(call[0] == "temporal-server" for call in self.calls()))

    def test_temporal_rejects_shared_visibility_database(self):
        result = self.temporal(TEMPORAL_VISIBILITY_DB="workbench")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("must be different", result.stderr)
        self.assertFalse(any(call[0] == "temporal-server" for call in self.calls()))

    def test_mem0_migrates_before_starting_server(self):
        result = self.mem0()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.calls()[-2:], [
            ["alembic", "upgrade", "head"],
            ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"],
        ])

    def test_mem0_stops_when_migration_fails(self):
        result = self.mem0(FAIL_COMMAND="alembic")
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(any(call[0] == "uvicorn" for call in self.calls()))

    def test_mem0_rejects_unsupported_startup_provider(self):
        result = self.mem0(MEM0_LLM_PROVIDER="anthropic")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("configure other providers through its API", result.stderr)


if __name__ == "__main__":
    unittest.main()
