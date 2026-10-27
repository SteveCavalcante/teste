"""Persistência local com escrita atômica e controle de concorrência."""

import json
import os
import tempfile
from pathlib import Path
from threading import RLock


class ProjectRepository:
    MAX_BYTES = 50 * 1024 * 1024
    KEYS = {"conecta-projects-v1", "conecta-layouts-v1", "conecta-contabil-v1"}

    def __init__(self, directory):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self.path = self.directory / "portal.json"
        self.lock = RLock()

    def read(self):
        with self.lock:
            if not self.path.exists():
                return {"revision": 0, "values": {}}
            obj = json.loads(self.path.read_text(encoding="utf-8"))
            if (
                not isinstance(obj, dict)
                or not isinstance(obj.get("revision"), int)
                or not isinstance(obj.get("values"), dict)
            ):
                raise ValueError(
                    "Arquivo de projetos inválido; corrija ou restaure o arquivo antes de salvar."
                )
            return obj

    def write(self, expected, values):
        if (
            not isinstance(expected, int)
            or not isinstance(values, dict)
            or any(k not in self.KEYS for k in values)
        ):
            raise ValueError("Dados de projetos inválidos.")
        with self.lock:
            current = self.read()
            if current["revision"] != expected:
                raise FileExistsError(
                    "Os projetos foram alterados em outra janela. Recarregue após preservar suas alterações."
                )
            record = {"revision": expected + 1, "values": values}
            path = None
            try:
                with tempfile.NamedTemporaryFile(
                    mode="w", dir=self.directory, encoding="utf-8", delete=False
                ) as f:
                    path = f.name
                    json.dump(record, f, ensure_ascii=False, indent=2)
                    f.write("\n")
                    f.flush()
                    os.fsync(f.fileno())
                os.replace(path, self.path)
            finally:
                if path and os.path.exists(path):
                    os.unlink(path)
            return record
