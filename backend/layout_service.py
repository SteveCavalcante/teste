"""Regras e validação de layouts, independentes de HTTP e de arquivos."""

import re
from datetime import datetime


class LayoutService:
    TYPES = {"STRING", "INT", "DECIMAL", "DATE", "DATETIME"}
    IDENTIFIER = re.compile(r"[A-Za-z0-9_-]{1,100}\Z")
    FIELD_NAME = re.compile(r"[A-Za-z_][A-Za-z0-9_-]*\Z")

    @classmethod
    def validate(cls, value, expected_id=None, require_code=True):
        if not isinstance(value, dict):
            raise ValueError("Layout inválido.")
        identifier = value.get("id", "")
        if not isinstance(identifier, str) or not cls.IDENTIFIER.fullmatch(identifier):
            raise ValueError("Identificador inválido.")
        if expected_id is not None and identifier != expected_id:
            raise ValueError("Identificador diferente do informado na URL.")
        name = str(value.get("name") or "").strip()
        if not name or len(name) > 100:
            raise ValueError("Informe um nome com até 100 caracteres.")
        code = str(value.get("code") or "").strip()
        if len(code) > 100 or (require_code and not code):
            raise ValueError("Preencha o código do layout com até 100 caracteres.")
        source_fields = value.get("fields")
        if not isinstance(source_fields, list) or not 1 <= len(source_fields) <= 10000:
            raise ValueError("Informe entre 1 e 10.000 campos.")

        products, targets, fields = set(), set(), []
        for field in source_fields:
            if not isinstance(field, dict):
                raise ValueError("Campo inválido.")
            product = str(
                field.get("campo_produto", field.get("campo_origem", "")) or ""
            ).strip()
            target = str(field.get("campo_dataprep") or "").strip()
            kind = str(field.get("tipo") or "").strip().upper()
            if (
                product and not cls.FIELD_NAME.fullmatch(product)
            ) or not cls.FIELD_NAME.fullmatch(target):
                raise ValueError("Nome de campo inválido.")
            if kind not in cls.TYPES:
                raise ValueError("Tipo inválido: " + kind)
            if product and product.casefold() in products:
                raise ValueError("Campo de produto duplicado: " + product)
            if target.casefold() in targets:
                raise ValueError("Campo DataPrep duplicado: " + target)
            if product:
                products.add(product.casefold())
            targets.add(target.casefold())
            fields.append(
                {"campo_produto": product, "campo_dataprep": target, "tipo": kind}
            )

        for field in fields:
            if (
                field["campo_dataprep"].casefold() in products
                and field["campo_dataprep"].casefold()
                != field["campo_produto"].casefold()
            ):
                raise ValueError("Mapeamento de campos ambíguo.")
        return {
            "schemaVersion": 3,
            "id": identifier,
            "name": name,
            "code": code,
            "fields": fields,
        }

    @staticmethod
    def valid_date(value):
        if not isinstance(value, str):
            return None
        try:
            datetime.fromisoformat(value.replace("Z", "+00:00"))
            return value
        except ValueError:
            return None
