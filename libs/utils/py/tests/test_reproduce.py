"""Offline reproducibility, including the writer's top-folder zip layout."""

import csv
import json
import os
from pathlib import Path
import shutil
import subprocess
from zipfile import ZipFile

import pytest

import aei
from aei.fingerprint import _fingerprint_rows


RECORDS = [
    {"isolateId": "002", "sampleDate": "2025-03-02", "ward": "URO", "organism": 'E. coli ä / "x"',
     "results": {"TZP": "S", "AMC": "R"}},
    {"isolateId": "001", "sampleDate": "2025-03-01", "ward": "ICU", "organism": "NA", "results": {}},
    {"isolateId": "002", "sampleDate": "2025-03-01", "ward": "URO", "organism": "E. coli", "results": {"AMC": "I"}},
]
ROOT = Path(__file__).resolve().parents[4]


@pytest.fixture
def reproducible_folder(tmp_path):
    fields = [{"name": name, "type": "date" if name == "sampleDate" else "string"}
              for name in ("isolateId", "sampleDate", "ward", "organism", "AMC", "TZP")]
    for field in fields[-2:]:
        field["role"] = "result"
    descriptor = {"name": "spring", "title": "Spring", "aei": {
        "format": "aei-package/1", "mode": "frozen", "asOf": "2025-03-02", "fingerprint": _fingerprint_rows(RECORDS)},
        "resources": [{"name": "isolates", "path": "isolates.csv", "schema": {"fields": fields}}]}
    (tmp_path / "datapackage.json").write_text(json.dumps(descriptor), encoding="utf-8")
    with (tmp_path / "isolates.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=[f["name"] for f in fields])
        writer.writeheader()
        for record in RECORDS:
            writer.writerow({**{k: v for k, v in record.items() if k != "results"}, **record["results"]})
    methods = [
        {"label": "Isolates", "id": "isolates", "value": 3, "method": "Row count", "recipe": {"op": "count", "table": "isolates"}},
        {"label": "URO organisms", "id": "organisms", "value": 2, "method": "Distinct", "recipe": {
            "op": "distinct", "table": "isolates", "column": "organism", "where": {"ward": "URO"}}},
        {"label": "Wrong", "value": 10, "recipe": {"op": "count", "table": "isolates", "where": {"AMC": "R", "ward": "URO"}}},
        {"label": "Unknown", "value": 4, "recipe": {"op": "future"}},
        {"label": "Missing", "value": 5},
        {"label": "Untested", "value": 1, "recipe": {"op": "count", "table": "isolates", "where": {"AMC": None}}},
    ]
    (tmp_path / "methods.json").write_text(json.dumps(methods), encoding="utf-8")
    (tmp_path / "README.md").write_text("# Reproduce\n", encoding="utf-8")
    return tmp_path


@pytest.mark.parametrize("layout", ["folder", "root", "top"])
def test_verify_and_reproduce(reproducible_folder, tmp_path, layout):
    path = reproducible_folder
    if layout != "folder":
        path = tmp_path / "spring.zip"
        with ZipFile(path, "w") as archive:
            for file in reproducible_folder.glob("*.*"):
                if file != path:
                    archive.write(file, ("spring/" if layout == "top" else "") + file.name)
    pkg = aei.read_package(path)
    checked = pkg.verify()
    assert checked.ok is True
    assert checked.rows == checked.expected_rows == 3
    assert checked.sha256 == checked.expected_sha256 == _fingerprint_rows(RECORDS)["sha256"]
    assert "✓ Same data: 3 rows" in repr(checked)
    assert "Same data" in checked._repr_html_()
    numbers = aei.reproduce(pkg)
    assert list(numbers.columns) == ["number", "id", "shown", "recomputed", "match", "method"]
    assert numbers["match"].tolist() == [True, True, False, None, None, True]
    assert numbers["recomputed"].iloc[:3].tolist() == [3, 2, 1]
    pkg.isolates.loc[0, "AMC"] = "S"
    assert pkg.verify().ok is False
    assert "✗ Data changed" in repr(pkg.verify())
    pkg.meta["mode"] = "continuous"
    assert pkg.verify().ok is None
    assert "Continuous project: no frozen fingerprint to check; 3 rows as of 2025-03-02." in repr(pkg.verify())
    assert list(aei.reproduce(aei.Package("empty", "", {}, {}, {}, [], "")).columns) == list(numbers.columns)


def test_offline_typescript_and_r_parity(reproducible_folder):
    node = shutil.which("node")
    if not node:
        pytest.skip("Node unavailable")
    script = """
import { fingerprintRows } from './libs/utils/projects/src/node.ts';
let text = ''; for await (const chunk of process.stdin) text += chunk;
console.log(JSON.stringify(fingerprintRows(JSON.parse(text))));
"""
    output = subprocess.run([node, "--experimental-strip-types", "--input-type=module", "-e", script],
                            cwd=ROOT, input=json.dumps(RECORDS), text=True, capture_output=True, check=True)
    expected = json.loads(output.stdout)
    checked = aei.read_package(reproducible_folder).verify()
    assert {"rows": checked.rows, "sha256": checked.sha256} == expected
    rscript = os.environ.get("AEI_RSCRIPT") or shutil.which("Rscript")
    if not rscript:
        pytest.skip("Rscript unavailable for cross-language check")
    r = """
args <- commandArgs(TRUE)
for (file in list.files(file.path(args[1], 'libs/utils/r/R'), full.names = TRUE)) source(file)
v <- verify(read_package(args[2]))
cat(jsonlite::toJSON(list(rows = v$rows, sha256 = v$sha256), auto_unbox = TRUE))
"""
    output = subprocess.run([rscript, "-e", r, str(ROOT), str(reproducible_folder)],
                            cwd=ROOT, text=True, capture_output=True, check=True)
    assert json.loads(output.stdout) == expected


@pytest.mark.parametrize("name", ["../escape", "spring/../../escape", r"spring\..\escape"])
def test_unsafe_zip_entries(reproducible_folder, tmp_path, name):
    path = tmp_path / "unsafe.zip"
    with ZipFile(path, "w") as archive:
        archive.writestr(name, "bad")
        for file in reproducible_folder.glob("*.json"):
            archive.write(file, "spring/" + file.name)
    with pytest.raises(ValueError, match="escapes"):
        aei.read_package(path)


def test_reject_multiple_top_folders(tmp_path):
    path = tmp_path / "ambiguous.zip"
    with ZipFile(path, "w") as archive:
        archive.writestr("a/datapackage.json", "{}")
        archive.writestr("b/readme", "")
    with pytest.raises(ValueError, match="top-level"):
        aei.read_package(path)
