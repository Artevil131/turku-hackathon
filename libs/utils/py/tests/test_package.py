"""Typed, portable research packages (D-060, D-061)."""

import json
from zipfile import ZipFile

import pandas as pd
import pytest

from aei import Package, read_package


@pytest.fixture
def package_folder(tmp_path):
    folder = tmp_path / "package"
    folder.mkdir()
    fields = [
        {"name": "isolateId", "type": "string", "title": "Isolate", "description": "Lab identifier"},
        {"name": "count", "type": "integer"},
        {"name": "rate", "type": "number", "unit": "%"},
        {"name": "sampleDate", "type": "date"},
        {"name": "created", "type": "datetime"},
        {"name": "flag", "type": "boolean"},
    ]
    descriptor = {
        "profile": "tabular-data-package", "name": "spring", "title": "Spring isolates", "created": "2026-10-17",
        "aei": {"format": "aei-package/1", "asOf": "2025-04-01", "mode": "frozen", "scope": {"units": ["URO"]}},
        "resources": [{
            "name": "isolates", "path": "isolates.csv", "profile": "tabular-data-resource", "format": "csv",
            "mediatype": "text/csv", "encoding": "utf-8", "schema": {"fields": fields},
        }],
    }
    (folder / "datapackage.json").write_text(json.dumps(descriptor), encoding="utf-8")
    (folder / "isolates.csv").write_text(
        'isolateId,count,rate,sampleDate,created,flag\n'
        '001,3,2.5,2025-03-01,2025-03-01T12:30:00Z,true\n'
        'NA,,,,,\n'
        '"=unchanged",0,0,2025-03-02,2025-03-02T00:00:00Z,false\n', encoding="utf-8-sig",
    )
    (folder / "methods.json").write_text(json.dumps([{"label": "Count", "value": 3, "method": "count", "parameters": {}}]))
    (folder / "README.md").write_text("# Spring\n", encoding="utf-8")
    return folder


def archive(folder, target):
    with ZipFile(target, "w") as zipped:
        for path in folder.iterdir():
            zipped.write(path, path.name)
    return target


@pytest.mark.parametrize("zipped", [False, True])
def test_read_package(package_folder, tmp_path, zipped):
    path = archive(package_folder, tmp_path / "package.zip") if zipped else package_folder
    pkg = read_package(str(path))
    assert isinstance(pkg, Package)
    assert pkg.name == "spring" and pkg.title == "Spring isolates"
    assert pkg.meta["asOf"] == "2025-04-01"
    assert pkg.isolates is pkg.tables["isolates"]
    assert pkg.isolates["isolateId"].tolist() == ["001", "NA", "=unchanged"]
    assert str(pkg.isolates["isolateId"].dtype).startswith("string")
    assert str(pkg.isolates["count"].dtype) == "Int64"
    assert str(pkg.isolates["rate"].dtype) == "float64"
    assert str(pkg.isolates["sampleDate"].dtype) == "datetime64[ns]"
    assert pkg.isolates.loc[0, "sampleDate"] == pd.Timestamp("2025-03-01")
    assert pkg.isolates.loc[0, "created"] == pd.Timestamp("2025-03-01T12:30:00Z")
    assert str(pkg.isolates["flag"].dtype) == "boolean"
    assert pkg.isolates.loc[0, "flag"] == True
    assert pkg.isolates.loc[2, "flag"] == False
    assert pkg.isolates.loc[1].drop("isolateId").isna().all()
    assert pkg.fields["isolates"][2]["unit"] == "%"
    assert pkg.methods == [{"label": "Count", "value": 3, "method": "count", "parameters": {}}]
    assert pkg.readme == "# Spring\n"
    assert "isolates: 3 rows x 6 columns" in repr(pkg)
    with pytest.raises(AttributeError):
        pkg.missing


def change_descriptor(folder, change):
    path = folder / "datapackage.json"
    descriptor = json.loads(path.read_text())
    change(descriptor)
    path.write_text(json.dumps(descriptor))


@pytest.mark.parametrize("zipped", [False, True])
def test_bad_format(package_folder, tmp_path, zipped):
    change_descriptor(package_folder, lambda d: d["aei"].update(format="aei-package/2"))
    path = archive(package_folder, tmp_path / "bad.zip") if zipped else package_folder
    with pytest.raises(ValueError, match="format"):
        read_package(path)


@pytest.mark.parametrize("resource", ["../outside.csv", "/tmp/isolates.csv", "nested/../../outside.csv", r"..\outside.csv", r"C:\isolates.csv"])
@pytest.mark.parametrize("zipped", [False, True])
def test_path_traversal(package_folder, tmp_path, resource, zipped):
    change_descriptor(package_folder, lambda d: d["resources"][0].update(path=resource))
    path = archive(package_folder, tmp_path / "bad.zip") if zipped else package_folder
    with pytest.raises(ValueError, match="escapes"):
        read_package(path)


def test_symlink_escape(package_folder, tmp_path):
    outside = tmp_path / "outside.csv"
    outside.write_text("secret\n")
    (package_folder / "link.csv").symlink_to(outside)
    change_descriptor(package_folder, lambda d: d["resources"][0].update(path="link.csv"))
    with pytest.raises(ValueError, match="escapes"):
        read_package(package_folder)


@pytest.mark.parametrize("value,column", [("not-a-date", "sampleDate"), ("maybe", "flag"), ("1.5", "count")])
def test_bad_type(package_folder, value, column):
    header = "isolateId,count,rate,sampleDate,created,flag".split(",")
    row = ["x", "1", "2.5", "2025-01-01", "2025-01-01T00:00:00Z", "true"]
    row[header.index(column)] = value
    (package_folder / "isolates.csv").write_text(",".join(header) + "\n" + ",".join(row) + "\n")
    with pytest.raises((ValueError, TypeError)):
        read_package(package_folder)
