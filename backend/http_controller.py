"""Controller HTTP: valida a requisição e delega ao repositório."""

import json
import mimetypes
import re
from http.server import BaseHTTPRequestHandler
from urllib.parse import unquote, urlsplit


class PortalHttpController(BaseHTTPRequestHandler):
    public_root = None
    repository = None
    port = 8080
    project_repository = None

    def send_json(self, status, payload):
        self.send_bytes(
            status,
            json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            "application/json; charset=utf-8",
        )

    def send_bytes(self, status, body, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def read_json(self):
        if self.headers.get_content_type() != "application/json":
            raise ValueError("Envie application/json.")
        if self.headers.get("Origin") not in (
            None,
            "http://" + self.headers.get("Host", ""),
        ):
            raise PermissionError("Origem não permitida.")
        size = int(self.headers.get("Content-Length", "0"))
        if (
            not 0
            < size
            <= (
                self.project_repository.MAX_BYTES
                if urlsplit(self.path).path == "/api/projects"
                and self.project_repository
                else self.repository.MAX_BYTES
            )
        ):
            raise ValueError("Conteúdo vazio ou maior que 2 MB.")
        return json.loads(self.rfile.read(size).decode("utf-8"))

    def dispatch(self):
        try:
            if self.headers.get("Host") not in {
                "localhost:" + str(self.port),
                "127.0.0.1:" + str(self.port),
            }:
                raise PermissionError("Host não permitido.")
            route = unquote(urlsplit(self.path).path)
            if route == "/api/projects" and self.project_repository is not None:
                if self.command == "GET":
                    self.send_json(200, self.project_repository.read())
                    return
                if self.command == "PUT":
                    payload = self.read_json()
                    if not isinstance(payload, dict):
                        raise ValueError("Dados inválidos.")
                    self.send_json(
                        200,
                        self.project_repository.write(
                            payload.get("revision"), payload.get("values")
                        ),
                    )
                    return
            if route == "/api/layouts" and self.command == "GET":
                layouts, errors, _ = self.repository.list()
                self.send_json(
                    200,
                    {
                        "storage": "project",
                        "directory": "layouts",
                        "layouts": layouts,
                        "errors": errors,
                    },
                )
                return
            match = re.fullmatch(r"/api/layouts/([A-Za-z0-9_-]{1,100})", route)
            if match and self.command in {"PUT", "DELETE"}:
                body = self.read_json()
                if not isinstance(body, dict):
                    raise ValueError("Envie um objeto JSON.")
                identifier = match.group(1)
                if self.command == "PUT":
                    self.send_json(
                        200, {"layout": self.repository.save(identifier, body)}
                    )
                else:
                    self.repository.delete(identifier, body.get("confirmation"))
                    self.send_json(200, {"deleted": identifier})
                return
            if route.startswith("/api/"):
                self.send_json(404, {"error": "Rota não encontrada."})
                return
            if self.command not in {"GET", "HEAD"}:
                self.send_json(405, {"error": "Método não permitido."})
                return
            filename = (
                self.public_root / ("index.html" if route == "/" else route.lstrip("/"))
            ).resolve()
            if self.public_root not in filename.parents or any(
                part.startswith(".")
                for part in filename.relative_to(self.public_root).parts
            ):
                raise PermissionError("Arquivo não disponível.")
            if not filename.is_file():
                raise FileNotFoundError("Arquivo não encontrado.")
            content_type = (
                mimetypes.guess_type(filename.name)[0] or "application/octet-stream"
            )
            if filename.suffix in {".js", ".css", ".html", ".json"}:
                content_type = {
                    ".js": "text/javascript",
                    ".css": "text/css",
                    ".html": "text/html",
                    ".json": "application/json",
                }[filename.suffix] + "; charset=utf-8"
            self.send_bytes(200, filename.read_bytes(), content_type)
        except FileExistsError as error:
            self.send_json(409, {"error": str(error)})
        except PermissionError as error:
            self.send_json(403, {"error": str(error)})
        except FileNotFoundError as error:
            self.send_json(404, {"error": str(error)})
        except (ValueError, UnicodeError, OSError) as error:
            self.send_json(400, {"error": str(error)})

    do_GET = dispatch
    do_HEAD = dispatch
    do_PUT = dispatch
    do_DELETE = dispatch
    do_POST = dispatch
