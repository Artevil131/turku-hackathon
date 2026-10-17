"""Read the D-060 research package without extracting its archive."""

from __future__ import annotations

import io
import json
from dataclasses import dataclass
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import TYPE_CHECKING
from zipfile import ZipFile

if TYPE_CHECKING:
    import pandas as pd


@dataclass
class Package:
    name: str
    title: str
    meta: dict
    tables: dict[str, pd.DataFrame]
    fields: dict[str, list[dict]]
    methods: list[dict]
    readme: str

    def __getattr__(self, name: str):
        tables = self.__dict__.get("tables", {})
        if name in tables:
            return tables[name]
        raise AttributeError(name)

    def __repr__(self) -> str:
        tables = ", ".join(f"{name}: {table.shape[0]} rows x {table.shape[1]} columns" for name, table in self.tables.items())
        return f"Package({self.name!r}, {tables})"


def _safe_path(path: str) -> str:
    posix = PurePosixPath(path)
    windows = PureWindowsPath(path)
    if not path or posix.is_absolute() or windows.root or windows.drive or ".." in posix.parts or ".." in windows.parts:
        raise ValueError(f"Resource path escapes the package: {path!r}")
    return path


def _table(data: bytes, fields: list[dict]) -> pd.DataFrame:
    import pandas as pd

    table = pd.read_csv(io.BytesIO(data), encoding="utf-8-sig", dtype="string", keep_default_na=False, na_values=[""])
    for field in fields:
        name, kind = field["name"], field["type"]
        column = table[name]
        if kind == "integer":
            table[name] = column.astype("Int64")
        elif kind == "number":
            table[name] = pd.to_numeric(column, errors="raise").astype(float)
        elif kind == "date":
            table[name] = pd.to_datetime(column, format="%Y-%m-%d", errors="raise").astype("datetime64[ns]")
        elif kind == "datetime":
            table[name] = pd.to_datetime(column, format="ISO8601", errors="raise")
        elif kind == "boolean":
            values = column.str.lower()
            if not values.dropna().isin(["true", "false", "1", "0"]).all():
                raise ValueError(f"Invalid boolean in column {name!r}")
            table[name] = values.map({"true": True, "false": False, "1": True, "0": False}).astype("boolean")
        elif kind == "string":
            table[name] = column.astype("string")
        else:
            raise ValueError(f"Unsupported field type: {kind!r}")
    return table


def read_package(path: str | Path) -> Package:
    """Load a package zip or folder into typed tables, retaining its column dictionary and methods."""
    path = Path(path)

    def load(read) -> Package:
        descriptor = json.loads(read("datapackage.json"))
        meta = descriptor.get("aei", {})
        if meta.get("format") != "aei-package/1":
            raise ValueError("Expected AEI package format 'aei-package/1'")
        resources = descriptor["resources"]
        for resource in resources:
            _safe_path(resource["path"])
        fields = {resource["name"]: resource["schema"]["fields"] for resource in resources}
        tables = {resource["name"]: _table(read(resource["path"]), fields[resource["name"]]) for resource in resources}
        return Package(
            name=descriptor["name"], title=descriptor["title"], meta=meta, tables=tables, fields=fields,
            methods=json.loads(read("methods.json")), readme=read("README.md").decode("utf-8-sig"),
        )

    if path.is_dir():
        root = path.resolve()

        def read(name: str) -> bytes:
            target = (root / _safe_path(name)).resolve()
            if not target.is_relative_to(root):
                raise ValueError(f"Resource path escapes the package: {name!r}")
            return target.read_bytes()

        return load(read)
    with ZipFile(path) as archive:
        return load(archive.read)
