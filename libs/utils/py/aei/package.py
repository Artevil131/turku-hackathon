"""Read the D-060 research package without extracting its archive."""

from __future__ import annotations

import io
import json
from dataclasses import dataclass
from html import escape
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import TYPE_CHECKING
from zipfile import ZipFile

from aei.fingerprint import _fingerprint_rows

if TYPE_CHECKING:
    import pandas as pd


@dataclass
class VerifyResult:
    ok: bool | None
    rows: int
    sha256: str
    expected_rows: int | None
    expected_sha256: str | None
    message: str

    def __repr__(self) -> str:
        symbol = "✓" if self.ok else "✗" if self.ok is False else "ℹ"
        return f"{symbol} {self.message}"

    def _repr_html_(self) -> str:
        return f"<p>{escape(repr(self))}</p>"


@dataclass
class Package:
    name: str
    title: str
    meta: dict
    tables: dict[str, pd.DataFrame]
    fields: dict[str, list[dict]]
    methods: list[dict]
    readme: str

    def verify(self) -> VerifyResult:
        """Check exported isolates against the frozen project's fingerprint, offline."""
        import pandas as pd

        codes = [field["name"] for field in self.fields["isolates"] if field.get("role") == "result"]
        records = []
        for row in self.isolates.to_dict("records"):
            records.append({
                "isolateId": row["isolateId"], "sampleDate": row["sampleDate"].strftime("%Y-%m-%d"),
                "ward": row["ward"], "organism": row["organism"],
                "results": {code: row[code] for code in codes if pd.notna(row[code]) and row[code] != ""},
            })
        actual = _fingerprint_rows(records)
        expected = self.meta.get("fingerprint") or {}
        ok = None
        if self.meta.get("mode") == "continuous":
            message = f"Continuous project: no frozen fingerprint to check; {actual['rows']} rows as of {self.meta.get('asOf')}."
        elif not expected:
            message = f"No frozen fingerprint to check; {actual['rows']} rows."
        else:
            ok = actual == expected
            message = (f"Same data: {actual['rows']} rows, fingerprint matches the frozen project." if ok else
                       f"Data changed: {actual['rows']} rows, row count or fingerprint differs from the frozen project.")
        return VerifyResult(ok, actual["rows"], actual["sha256"], expected.get("rows"), expected.get("sha256"), message)

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
        names = archive.namelist()
        for name in names:
            _safe_path(name)
        prefix = ""
        if "datapackage.json" not in names:
            tops = {PurePosixPath(name).parts[0] for name in names}
            if len(tops) != 1 or f"{next(iter(tops), '')}/datapackage.json" not in names:
                raise ValueError("Expected datapackage.json at the root or in one top-level folder")
            prefix = f"{next(iter(tops))}/"
        return load(lambda name: archive.read(prefix + _safe_path(name)))


def reproduce(pkg: Package) -> pd.DataFrame:
    """Recompute supported methods.json recipes; unknown recipes remain unchecked."""
    import pandas as pd

    rows = []
    for number in pkg.methods:
        recipe = number.get("recipe") or {}
        computed = match = None
        if recipe.get("op") in ("count", "distinct"):
            table = pkg.tables[recipe["table"]]
            for column, value in recipe.get("where", {}).items():
                mask = table[column].isna() if value is None else table[column].eq(value).fillna(False)
                table = table.loc[mask]
            computed = len(table) if recipe["op"] == "count" else int(table[recipe["column"]].nunique())
            match = computed == number.get("value")
        rows.append({"number": number.get("label"), "id": number.get("id"), "shown": number.get("value"),
                     "recomputed": computed, "match": match, "method": number.get("method")})
    return pd.DataFrame(rows, columns=["number", "id", "shown", "recomputed", "match", "method"])
