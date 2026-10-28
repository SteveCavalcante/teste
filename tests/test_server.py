"""Testes da API Python com arquivos temporários e requisições HTTP reais."""

import json
import tempfile
import threading
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path

from backend.http_controller import PortalHttpController
from backend.layout_repository import LayoutRepository
from backend.project_repository import ProjectRepository


class ServerTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        root = Path(self.temporary.name)
        self.public = root / "dist"
        self.public.mkdir()
        (self.public / "index.html").write_text("<h1>Portal</h1>", encoding="utf-8")
        self.repository = LayoutRepository(root / "layouts")
        self.project_repository = ProjectRepository(root / "dados")
        handler = type(
            "TestHandler",
            (PortalHttpController,),
            {
                "public_root": self.public,
                "repository": self.repository,
                "project_repository": self.project_repository,
                "log_message": lambda *args: None,
            },
        )
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        handler.port = self.server.server_port
        self.worker = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.worker.start()
        self.layout = {
            "id": "teste",
            "name": "Layout de teste",
            "code": "0007",
            "fields": [
                {"campo_produto": "", "campo_dataprep": "VALOR", "tipo": "DECIMAL"}
            ],
        }

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.worker.join()
        self.temporary.cleanup()

    def request(self, method, route, payload=None, headers=None):
        connection = HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        request_headers = {"Content-Type": "application/json", **(headers or {})}
        connection.request(
            method,
            route,
            json.dumps(payload) if payload is not None else None,
            request_headers,
        )
        response = connection.getresponse()
        status, body = response.status, response.read()
        connection.close()
        return status, body

    def test_duplicate_names_ignore_case_and_spacing(self):
        self.repository.save("teste", self.layout)
        duplicate = {**self.layout, "id": "outro", "name": "  LAYOUT   DE TESTE "}
        with self.assertRaisesRegex(ValueError, "Já existe"):
            self.repository.save("outro", duplicate)
        values = {"conecta-projects-v1": {"projects": [
            {"id": "um", "name": "Projeto Teste"},
            {"id": "dois", "name": " projeto   teste "},
        ]}}
        with self.assertRaisesRegex(ValueError, "Já existe"):
            self.project_repository.write(0, values)
        self.assertEqual(self.project_repository.read()["revision"], 0)

    def test_layout_lifecycle_and_confirmation(self):
        status, body = self.request("PUT", "/api/layouts/teste", self.layout)
        self.assertEqual(status, 200)
        first = json.loads(body)["layout"]
        self.assertEqual(first["fields"][0]["campo_produto"], "")
        self.layout["name"] = "Renomeado"
        status, body = self.request("PUT", "/api/layouts/teste", self.layout)
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["layout"]["createdAt"], first["createdAt"])
        status, body = self.request("GET", "/api/layouts")
        self.assertEqual(json.loads(body)["layouts"][0]["name"], "Renomeado")
        self.assertEqual(
            self.request("DELETE", "/api/layouts/teste", {"confirmation": "excluir tudo"})[
                0
            ],
            400,
        )
        self.assertEqual(
            self.request("DELETE", "/api/layouts/teste", {"confirmation": "eXcLuIr"})[
                0
            ],
            200,
        )
        self.assertEqual(self.repository.list()[0], [])

    def test_invalid_input_and_file_protection(self):
        self.assertEqual(self.request("GET", "/")[0], 200)
        self.assertEqual(self.request("GET", "/%2e%2e/server.py")[0], 403)
        self.assertEqual(
            self.request("GET", "/", headers={"Host": "host-invalido"})[0], 403
        )
        self.assertEqual(
            self.request(
                "PUT",
                "/api/layouts/teste",
                self.layout,
                {"Origin": "http://outro-site"},
            )[0],
            403,
        )
        self.layout["fields"].append(self.layout["fields"][0].copy())
        self.assertEqual(self.request("PUT", "/api/layouts/teste", self.layout)[0], 400)
        (self.repository.directory / "layout-teste.json").write_text(
            "inválido", encoding="utf-8"
        )
        self.layout["fields"].pop()
        self.assertEqual(self.request("PUT", "/api/layouts/teste", self.layout)[0], 400)
        self.assertEqual(len(self.repository.list()[1]), 1)

    def test_mixed_case_hyphens_survive_save_and_reload(self):
        self.layout["fields"] = [
            {
                "campo_produto": "Tipo-Evento",
                "campo_dataprep": "cod-Evento",
                "tipo": "INT",
            }
        ]
        status, body = self.request("PUT", "/api/layouts/teste", self.layout)
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["layout"]["fields"], self.layout["fields"])
        self.assertEqual(self.repository.list()[0][0]["fields"], self.layout["fields"])
        self.layout["fields"].append(
            {"campo_produto": "Outro", "campo_dataprep": "COD-EVENTO", "tipo": "INT"}
        )
        self.assertEqual(self.request("PUT", "/api/layouts/teste", self.layout)[0], 400)

    def test_required_code_and_readable_legacy_records(self):
        missing = dict(self.layout)
        missing.pop("code")
        self.assertEqual(self.request("PUT", "/api/layouts/teste", missing)[0], 400)
        missing["code"] = "   "
        self.assertEqual(self.request("PUT", "/api/layouts/teste", missing)[0], 400)
        missing.pop("code")
        (self.repository.directory / "antigo.json").write_text(
            json.dumps(missing), encoding="utf-8"
        )
        status, body = self.request("GET", "/api/layouts")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["layouts"][0]["code"], "")
        status, body = self.request("PUT", "/api/layouts/teste", self.layout)
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["layout"]["code"], "0007")
        self.assertEqual(self.repository.list()[0][0]["code"], "0007")

    def test_project_persistence_and_concurrent_write(self):
        status, body = self.request("GET", "/api/projects")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["revision"], 0)
        values = {"conecta-projects-v1": {"projects": [{"id": "teste-1", "name": "Meu projeto"}]}}
        status, body = self.request("PUT", "/api/projects", {"revision": 0, "values": values})
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["revision"], 1)
        fresh = ProjectRepository(self.project_repository.directory).read()
        self.assertEqual(fresh["values"], values)
        status, _ = self.request("PUT", "/api/projects", {"revision": 0, "values": {}})
        self.assertEqual(status, 409)
        self.assertEqual(self.project_repository.read()["values"], values)
        status, _ = self.request("PUT", "/api/projects", {"revision": 1, "values": {"unknown": {}}})
        self.assertEqual(status, 400)

    def test_migration_projects_separate_and_atomic_index(self):
        repo = self.project_repository
        legacy = {"revision": 3, "values": {"conecta-projects-v1": {"selectedId": "p1", "projects": [{"id": "p1", "name": "Um"}, {"id": "p2", "name": "Dois"}]}}}
        repo.path.write_text(json.dumps(legacy), encoding="utf-8")
        self.assertEqual(repo.read(), legacy)
        result = repo.write(3, legacy["values"])
        self.assertEqual(result["revision"], 4)
        self.assertEqual(result["values"], legacy["values"])
        self.assertEqual(json.loads(repo.path.read_text(encoding="utf-8")), legacy)
        self.assertEqual(len(list(repo.projects_dir.glob("*.json"))), 2)
        updated = json.loads(json.dumps(result["values"]))
        updated["conecta-projects-v1"]["projects"][0]["name"] = "Alterado"
        result2 = repo.write(4, updated)
        self.assertEqual(result2["values"]["conecta-projects-v1"]["projects"][0]["name"], "Alterado")
        self.assertEqual(len(list(repo.projects_dir.glob("*.json"))), 2)
        with self.assertRaises(FileExistsError):
            repo.write(4, legacy["values"])
        self.assertEqual(repo.read(), result2)
        from unittest.mock import patch
        original_write = repo._atomic_write
        def interrupted(path, payload):
            if path == repo.index:
                raise OSError("interrupção simulada")
            return original_write(path, payload)
        with patch.object(repo, "_atomic_write", side_effect=interrupted):
            with self.assertRaises(OSError):
                repo.write(5, legacy["values"])
        self.assertEqual(repo.read(), result2)
        invalid = {"conecta-projects-v1": {"projects": [{"id": "p1"}, {"id": "p1"}]}}
        with self.assertRaises(ValueError):
            repo.write(5, invalid)
        self.assertEqual(repo.read(), result2)

    def test_legacy_layout_alias(self):
        self.layout["fields"] = [
            {"campo_origem": "produto", "campo_dataprep": "DESTINO", "tipo": "STRING"}
        ]
        status, body = self.request("PUT", "/api/layouts/teste", self.layout)
        self.assertEqual(status, 200)
        field = json.loads(body)["layout"]["fields"][0]
        self.assertEqual(field["campo_produto"], "produto")
        self.assertNotIn("campo_origem", field)


if __name__ == "__main__":
    unittest.main()
