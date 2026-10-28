"""Arquivos imutáveis por projeto e índice atômico com controle de revisão."""
import hashlib
import json
import os
import re
import tempfile
from pathlib import Path
from threading import RLock


class ProjectRepository:
    MAX_BYTES = 200 * 1024 * 1024
    KEYS = {"conecta-projects-v1", "conecta-layouts-v1", "conecta-contabil-v1"}
    FILE_NAME = re.compile(r"projeto-[0-9a-f]{24}-[0-9a-f]{64}\.json\Z")

    def __init__(self, directory):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self.path = self.directory / "portal.json"  # legado: nunca sobrescrito na migração
        self.index = self.directory / "indice.json"
        self.projects_dir = self.directory / "projetos"
        self.projects_dir.mkdir(parents=True, exist_ok=True)
        self.lock = RLock()

    def _read_json(self, path):
        if path.is_symlink():
            raise ValueError("Arquivo simbólico não é permitido.")
        return json.loads(path.read_text(encoding="utf-8"))

    def _atomic_write(self, path, payload):
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode="wb", dir=path.parent, delete=False) as file:
                temporary = file.name
                file.write(payload)
                file.flush()
                os.fsync(file.fileno())
            os.replace(temporary, path)
        finally:
            if temporary and os.path.exists(temporary):
                os.unlink(temporary)

    def read(self):
        with self.lock:
            if not self.index.exists():
                if not self.path.exists():
                    return {"revision": 0, "values": {}}
                data = self._read_json(self.path)
                if not isinstance(data, dict) or not isinstance(data.get("revision"), int) or not isinstance(data.get("values"), dict):
                    raise ValueError("Arquivo legado inválido; restaure o backup antes de salvar.")
                return data
            index = self._read_json(self.index)
            if not isinstance(index, dict) or not isinstance(index.get("revision"), int) or not isinstance(index.get("values"), dict) or not isinstance(index.get("project_files"), list):
                raise ValueError("Índice de projetos inválido; restaure o backup.")
            values = index["values"]
            if index.get("has_projects"):
                projects = []
                for name in index["project_files"]:
                    if not isinstance(name, str) or not self.FILE_NAME.fullmatch(name):
                        raise ValueError("Nome de arquivo de projeto inválido.")
                    project_path = self.projects_dir / name
                    if project_path.is_symlink():
                        raise ValueError("Arquivo simbólico não é permitido.")
                    try:
                        blob = project_path.read_bytes()
                    except FileNotFoundError as error:
                        raise ValueError("Arquivo de projeto não encontrado: " + name) from error
                    if hashlib.sha256(blob).hexdigest() != name[-69:-5]:
                        raise ValueError("Arquivo de projeto alterado ou corrompido: " + name)
                    project = json.loads(blob)
                    if not isinstance(project, dict) or not isinstance(project.get("id"), str):
                        raise ValueError("Conteúdo de projeto inválido: " + name)
                    projects.append(project)
                store = values.get("conecta-projects-v1")
                if not isinstance(store, dict):
                    raise ValueError("Metadados de projetos inválidos.")
                values["conecta-projects-v1"] = {**store, "projects": projects}
            return {"revision": index["revision"], "values": values}

    def write(self, expected, values):
        if not isinstance(expected, int) or not isinstance(values, dict) or any(k not in self.KEYS for k in values):
            raise ValueError("Dados de projetos inválidos.")
        with self.lock:
            current = self.read()
            if current["revision"] != expected:
                raise FileExistsError("Os projetos foram alterados em outra janela. Recarregue após preservar suas alterações.")
            previous_files = []
            if self.index.exists():
                previous_index = self._read_json(self.index)
                previous_files = previous_index.get("project_files", [])
            copied = dict(values)
            store = copied.get("conecta-projects-v1")
            has_projects = store is not None
            project_files = []
            if has_projects:
                if not isinstance(store, dict) or not isinstance(store.get("projects"), list):
                    raise ValueError("Lista de projetos inválida.")
                old_projects = current["values"].get("conecta-projects-v1", {}).get("projects", [])
                old_names = {p["id"]: " ".join(str(p.get("name", "")).split()).casefold() for p in old_projects}
                name_groups = {}
                for candidate in store["projects"]:
                    if not isinstance(candidate, dict):
                        raise ValueError("Parametrização inválida.")
                    candidate_name = " ".join(str(candidate.get("name", "")).split()).casefold()
                    name_groups.setdefault(candidate_name, []).append(candidate)
                for candidate_name, group in name_groups.items():
                    if candidate_name and len(group) > 1 and any(old_names.get(p.get("id")) != candidate_name for p in group):
                        raise ValueError("Já existe uma parametrização com esse nome.")
                seen = set()
                for project in store["projects"]:
                    if not isinstance(project, dict) or not isinstance(project.get("id"), str) or not project["id"] or project["id"] in seen:
                        raise ValueError("Identificador de projeto ausente ou duplicado.")
                    seen.add(project["id"])
                    data = (json.dumps(project, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
                    if len(data) > self.MAX_BYTES:
                        raise ValueError("Projeto excede 200 MB.")
                    name = "projeto-" + hashlib.sha256(project["id"].encode()).hexdigest()[:24] + "-" + hashlib.sha256(data).hexdigest() + ".json"
                    filename = self.projects_dir / name
                    if filename.is_symlink():
                        raise ValueError("Arquivo simbólico não é permitido.")
                    if filename.exists():
                        if filename.read_bytes() != data:
                            raise ValueError("Arquivo de projeto já existe com conteúdo inválido.")
                    else:
                        self._atomic_write(filename, data)
                    project_files.append(name)
                copied["conecta-projects-v1"] = {k: v for k, v in store.items() if k != "projects"}
                # Histórico da chave antiga duplicava as linhas do projeto ativo.
                copied.pop("conecta-contabil-v1", None)
            index = {"revision": expected + 1, "values": copied, "has_projects": has_projects, "project_files": project_files}
            self._atomic_write(self.index, (json.dumps(index, ensure_ascii=False, indent=2) + "\n").encode())
            # The committed index already points to complete files; remove only
            # superseded files from its immediately preceding version.
            for name in previous_files:
                if isinstance(name, str) and self.FILE_NAME.fullmatch(name) and name not in project_files:
                    try:
                        (self.projects_dir / name).unlink(missing_ok=True)
                    except OSError:
                        pass
            return self.read()
