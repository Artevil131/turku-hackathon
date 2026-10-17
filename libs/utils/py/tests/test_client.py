"""Contract responses and D-058 fingerprint parity, with no external service."""

import json
import shutil
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import pytest

from aei import AeiApiError, Client, Project, connect
from aei.client import _fingerprint_rows

ROOT = Path(__file__).resolve().parents[4]
RECORDS = [
    {"isolateId": "i2", "sampleDate": "2025-03-03", "ward": "URO", "organism": "Escherichia coli",
     "results": {"TZP": "S", "AMC": "R"}, "phenotypes": ["ESBL", "CPE"], "patientId": "p2"},
    {"isolateId": "i1", "sampleDate": "2025-03-01", "ward": "URO", "organism": "Escherichia coli",
     "results": {"AMC": "S"}, "phenotypes": [], "patientId": "p1"},
    {"isolateId": "i2", "sampleDate": "2025-03-02", "ward": "ICU", "organism": "Bactéria",
     "results": {"AMC": "R", "TZP": "R"}, "phenotypes": ["ESBL"], "patientId": "p3"},
]


@pytest.fixture
def api():
    calls = []
    scope = {"from": "2025-03-01", "to": "2025-04-01", "site": "tyks", "units": ["URO"],
             "organisms": ["Escherichia coli"], "phenotypes": ["ESBL"], "kinds": ["ignored"], "board": "ignored"}
    project = {"id": "spring", "name": "Spring", "description": "ESBL", "mode": "frozen", "asOf": "2025-03-15",
               "scope": scope, "createdAt": "2026-10-17T00:00:00Z", "updatedAt": "2026-10-17T00:00:00Z",
               "fingerprint": _fingerprint_rows(RECORDS[:1])}
    state = {"records": list(RECORDS), "project": project, "drift": False}

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            url = urlsplit(self.path)
            calls.append((url.path, parse_qs(url.query), self.headers.get("Authorization")))
            status = 200
            if url.path == "/api/isolates":
                # Deliberately return unfiltered rows to test the local matchesScope mirror too.
                data = {"asOf": "2025-06-01", "records": state["records"]}
            elif url.path == "/api/projects/spring":
                data = {"project": state["project"], "drift": state["drift"]}
            elif url.path == "/api/projects":
                data = {"projects": [state["project"]]}
            elif url.path == "/api/alerts":
                data = {"asOf": "2025-06-01", "alerts": [{"id": "a1", "kind": "cluster"}]}
            elif url.path == "/api/weekly":
                data = {"asOf": "2025-06-01", "weeks": ["2025-03-03", "2025-03-10"],
                        "units": {"URO": {"cultures": [3, 4], "phenotypes": {"ESBL": [1, 2], "CPE": [0, 1]}}}}
            elif url.path == "/api/clock":
                data = {"asOf": "2025-06-01", "playing": False}
            elif url.path == "/api/sites":
                data = {"asOf": "2025-06-01", "sites": [{"id": "tyks", "name": "Tyks"}]}
            elif url.path == "/api/projects/plain-error":
                self.send_response(503)
                self.end_headers()
                self.wfile.write(b"Unavailable")
                return
            else:
                status, data = 404, {"error": "project not found"}
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(data).encode())

        def log_message(self, *_args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}", calls, state
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


def test_isolates(api):
    url, calls, _ = api
    client = connect(url + "/", token="test-secret", site="tyks")
    assert isinstance(client, Client)
    frame = client.isolates(**{"from": "2025-03-01", "ward": "URO", "ageMin": 0, "specimen": None})
    assert frame["isolateId"].tolist() == ["i2", "i1", "i2"]
    assert frame.loc[0, "AMC"] == "R" and frame.loc[0, "TZP"] == "S"
    assert frame.loc[0, "phenotypes"] == "ESBL;CPE"
    assert frame.loc[0, "phenotype_list"] == ["ESBL", "CPE"]
    assert frame.loc[1, "phenotypes"] == "" and frame.loc[1, "phenotype_list"] == []
    assert "results" not in frame.columns
    assert calls[-1] == ("/api/isolates", {"site": ["tyks"], "from": ["2025-03-01"], "ward": ["URO"], "ageMin": ["0"]}, "Bearer test-secret")
    client.isolates(site="other")
    assert calls[-1][1]["site"] == ["other"]
    client.isolates(site=None)
    assert "site" not in calls[-1][1]
    assert "test-secret" not in repr(client)


def test_routes(api):
    url, calls, _ = api
    client = connect(url)
    assert client.alerts(**{"from": "2025-01-01"}).to_dict("records") == [{"id": "a1", "kind": "cluster"}]
    assert calls[-1][1] == {"from": ["2025-01-01"]}
    assert client.weekly(site="tyks").to_dict("records") == [
        {"ward": "URO", "week": "2025-03-03", "cultures": 3, "ESBL": 1, "CPE": 0},
        {"ward": "URO", "week": "2025-03-10", "cultures": 4, "ESBL": 2, "CPE": 1},
    ]
    assert client.clock() == {"asOf": "2025-06-01", "playing": False}
    assert client.sites() == [{"id": "tyks", "name": "Tyks"}]
    assert isinstance(client.projects()[0], Project)
    assert client.projects()[0].verify()
    assert all(auth is None for _, _, auth in calls)


@pytest.mark.parametrize("id,status,message", [("missing", 404, "project not found"), ("plain-error", 503, "Unavailable")])
def test_error(api, id, status, message):
    url, _, _ = api
    with pytest.raises(AeiApiError) as error:
        connect(url).project(id)
    assert error.value.status == status
    assert error.value.message == message
    assert str(error.value) == message


def test_project_verify(api):
    url, calls, state = api
    client = connect(url, site="not-the-project-site")
    project = client.project("spring")
    assert isinstance(project, Project)
    assert project.drift is False
    assert project.verify() is True
    assert calls[-1][1] == {"from": ["2025-03-01"], "to": ["2025-03-15"], "site": ["tyks"], "ward": ["URO"]}
    state["records"] = [dict(RECORDS[0], results={"TZP": "R", "AMC": "R"}), *RECORDS[1:]]
    state["drift"] = True
    assert project.verify() is False
    assert client.project("spring").drift is True
    state["project"]["mode"] = "continuous"
    with pytest.raises(ValueError, match="frozen"):
        client.project("spring").verify()


def test_project_scope(api):
    url, calls, state = api
    scope = state["project"]["scope"]
    scope.pop("site")
    scope.update(units=["URO", "ICU"], organisms=[], to="2025-03-02")
    state["project"]["fingerprint"] = _fingerprint_rows([RECORDS[2]])
    project = connect(url, site="ignored-default").project("spring")
    assert project.verify()
    assert calls[-1][1] == {"from": ["2025-03-01"], "to": ["2025-03-02"]}
    # Dates, organisms and phenotype selection are independent of the server filtering.
    state["records"].extend([
        dict(RECORDS[2], isolateId="old", sampleDate="2025-02-28"),
        dict(RECORDS[2], isolateId="later", sampleDate="2025-03-20"),
        dict(RECORDS[2], isolateId="no-phenotype", phenotypes=[]),
        dict(RECORDS[2], isolateId="wrong-unit", ward="OTHER"),
    ])
    assert project.verify()


def test_empty_responses(api):
    url, _, state = api
    state["records"] = []
    assert connect(url).isolates().empty


def test_import_is_lightweight():
    subprocess.run(
        [sys.executable, "-c", "import aei, sys; assert aei.read_package and aei.connect; "
         "assert not {'pandas', 'numpy', 'scipy', 'statsmodels', 'matplotlib'} & sys.modules.keys()"],
        cwd=ROOT, check=True,
    )


def test_fingerprint_parity():
    node = shutil.which("node")
    if node is None:
        pytest.skip("Node is not available")
    # Node 22+ strips the repo's TypeScript; type-only workspace imports vanish.
    script = """
import { fingerprintRows } from './libs/utils/projects/src/node.ts';
let text = '';
for await (const chunk of process.stdin) text += chunk;
console.log(JSON.stringify(fingerprintRows(JSON.parse(text))));
"""
    result = subprocess.run(
        [node, "--experimental-strip-types", "--input-type=module", "-e", script],
        cwd=ROOT, input=json.dumps(RECORDS, ensure_ascii=False), text=True, capture_output=True, check=True,
    )
    assert _fingerprint_rows(RECORDS) == json.loads(result.stdout)
    assert _fingerprint_rows(list(reversed(RECORDS))) == json.loads(result.stdout)
