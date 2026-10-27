"""Execute com python server.py. Usa somente a biblioteca padrão do Python 3.9+."""

import os
from http.server import ThreadingHTTPServer
from pathlib import Path

from backend.http_controller import PortalHttpController
from backend.layout_repository import LayoutRepository
from backend.project_repository import ProjectRepository


def main():
    root = Path(__file__).resolve().parent
    port = int(os.environ.get("PORT", "8080"))
    PortalHttpController.public_root = (root / "dist").resolve()
    PortalHttpController.repository = LayoutRepository(root / "layouts")
    PortalHttpController.project_repository = ProjectRepository(root / "dados")
    PortalHttpController.port = port
    with ThreadingHTTPServer(("127.0.0.1", port), PortalHttpController) as server:
        print("Portal em http://localhost:" + str(port))
        print("Layouts em " + str(root / "layouts"))
        print("Para encerrar, pressione Ctrl+C.")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
