"""Repository: persistência dos layouts em JSON, com escrita atômica."""

import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock

from backend.layout_service import LayoutService


class LayoutRepository:
    MAX_BYTES = 2 * 1024 * 1024

    def __init__(self, directory):
        self.directory = Path(directory).resolve()
        self.directory.mkdir(parents=True, exist_ok=True)
        self.lock = RLock()

    def list(self):
        layouts, errors, paths = [], [], {}
        with self.lock:
            for filename in sorted(self.directory.glob("*.json")):
                try:
                    if (
                        filename.is_symlink()
                        or filename.stat().st_size > self.MAX_BYTES
                    ):
                        raise ValueError("Arquivo inválido ou maior que 2 MB.")
                    raw = json.loads(filename.read_text(encoding="utf-8"))
                    record = LayoutService.validate(raw, require_code=False)
                    if record["id"] in paths:
                        raise ValueError("Identificador duplicado: " + record["id"])
                    record["createdAt"] = LayoutService.valid_date(raw.get("createdAt"))
                    record["updatedAt"] = LayoutService.valid_date(raw.get("updatedAt"))
                    paths[record["id"]] = filename
                    layouts.append(record)
                except (ValueError, OSError) as error:
                    errors.append(filename.name + ": " + str(error))
        return layouts, errors, paths

    def save(self, identifier, payload):
        record = LayoutService.validate(payload, identifier)
        with self.lock:
            layouts, _, paths = self.list()
            old = next((item for item in layouts if item["id"] == identifier), None)
            if any(
                item["id"] != identifier and " ".join(item["name"].split()).casefold() == " ".join(record["name"].split()).casefold()
                for item in layouts
            ):
                raise ValueError("Já existe outro layout com esse nome.")
            now = (
                datetime.now(timezone.utc)
                .isoformat(timespec="milliseconds")
                .replace("+00:00", "Z")
            )
            record.update(createdAt=old["createdAt"] if old else now, updatedAt=now)
            filename = paths.get(
                identifier, self.directory / ("layout-" + identifier + ".json")
            )
            if old is None and (filename.exists() or filename.is_symlink()):
                raise ValueError(
                    "Já existe um arquivo inválido com esse identificador."
                )
            temporary = None
            try:
                with tempfile.NamedTemporaryFile(
                    mode="w",
                    encoding="utf-8",
                    dir=self.directory,
                    suffix=".tmp",
                    delete=False,
                ) as stream:
                    temporary = Path(stream.name)
                    json.dump(record, stream, ensure_ascii=False, indent=4)
                    stream.write("\n")
                os.replace(temporary, filename)
            finally:
                if temporary is not None:
                    temporary.unlink(missing_ok=True)
            return record

    def delete(self, identifier, confirmation):
        if not isinstance(confirmation, str) or confirmation.strip().casefold() != "excluir":
            raise ValueError("Digite excluir para confirmar.")
        with self.lock:
            _, _, paths = self.list()
            if identifier not in paths:
                raise FileNotFoundError("Layout não encontrado.")
            paths[identifier].unlink()
