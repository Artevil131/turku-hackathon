"""Standard-library, read-only client for the AEI API contract."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import TYPE_CHECKING
from urllib.error import HTTPError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

from aei.fingerprint import _fingerprint_rows

if TYPE_CHECKING:
    import pandas as pd


class AeiApiError(Exception):
    def __init__(self, status: int, message: str):
        self.status = status
        self.message = message
        super().__init__(message)


@dataclass
class Project:
    id: str
    name: str
    description: str
    mode: str
    scope: dict
    createdAt: str
    updatedAt: str
    asOf: str | None = None
    fingerprint: dict | None = None
    drift: bool | None = None
    _client: Client | None = field(default=None, repr=False, compare=False)

    def verify(self) -> bool:
        """Refetch a frozen project's released rows and check the D-058 count and SHA-256."""
        if self.mode != "frozen":
            raise ValueError("Only frozen projects have a fingerprint to verify")
        if self._client is None or self.asOf is None or self.fingerprint is None:
            raise ValueError("Verification needs a client, asOf and fingerprint")
        scope = self.scope
        units = scope.get("units", [])
        to = min(self.asOf, scope.get("to") or self.asOf)
        records = self._client._get("/api/isolates", {
            "from": scope.get("from"), "to": to, "site": scope.get("site"),
            "ward": units[0] if len(units) == 1 else None,
        })["records"]
        # kinds and board describe views, not isolate filters (matchesScope).
        records = [r for r in records if
            (not scope.get("from") or r["sampleDate"] >= scope["from"])
            and r["sampleDate"] <= to
            and (not units or r["ward"] in units)
            and (not scope.get("organisms") or r["organism"] in scope["organisms"])
            and (not scope.get("phenotypes") or any(p in r["phenotypes"] for p in scope["phenotypes"]))
        ]
        return _fingerprint_rows(records) == self.fingerprint


@dataclass
class Client:
    url: str
    token: str | None = field(default=None, repr=False)
    site: str | None = None

    def _get(self, path: str, query: dict | None = None):
        params = urlencode({key: value for key, value in (query or {}).items() if value is not None})
        url = f"{self.url.rstrip('/')}{path}" + (f"?{params}" if params else "")
        headers = {"Accept": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        try:
            with urlopen(Request(url, headers=headers)) as response:
                return json.load(response)
        except HTTPError as error:
            text = error.read().decode("utf-8", errors="replace")
            try:
                message = json.loads(text).get("error") or text
            except (ValueError, AttributeError):
                message = text
            raise AeiApiError(error.code, str(message) or str(error.reason)) from error

    def _query(self, query: dict) -> dict:
        return {"site": self.site, **query}

    def isolates(self, **query) -> pd.DataFrame:
        """One row per isolate, with antibiotic columns and both text and list phenotypes.

        Filters use contract names: from (pass via **dict), to, ward, specimen,
        organism, sex, ageMin, ageMax and site.
        """
        import pandas as pd

        records = self._get("/api/isolates", self._query(query))["records"]
        rows = []
        for record in records:
            row = {key: value for key, value in record.items() if key not in ("results", "phenotypes")}
            phenotypes = list(record["phenotypes"])
            row.update(record["results"])
            row.update(phenotypes=";".join(phenotypes), phenotype_list=phenotypes)
            rows.append(row)
        return pd.DataFrame(rows)

    def alerts(self, **query) -> pd.DataFrame:
        import pandas as pd

        return pd.DataFrame(self._get("/api/alerts", self._query(query))["alerts"])

    def weekly(self, **query) -> pd.DataFrame:
        """Raw weekly counts: one row per ward/week, cultures and one count per phenotype."""
        import pandas as pd

        data = self._get("/api/weekly", self._query(query))
        rows = []
        for ward, counts in data["units"].items():
            for i, week in enumerate(data["weeks"]):
                rows.append({"ward": ward, "week": week, "cultures": counts["cultures"][i],
                             **{p: values[i] for p, values in counts["phenotypes"].items()}})
        return pd.DataFrame(rows)

    def clock(self) -> dict:
        return self._get("/api/clock")

    def sites(self) -> list:
        return self._get("/api/sites")["sites"]

    def projects(self) -> list[Project]:
        return [Project(**project, _client=self) for project in self._get("/api/projects")["projects"]]

    def project(self, id: str) -> Project:
        data = self._get(f"/api/projects/{quote(id, safe='')}")
        return Project(**data["project"], drift=data.get("drift"), _client=self)


def connect(url: str, token: str | None = None, site: str | None = None) -> Client:
    """Connect to an AEI server, optionally authenticating and defaulting data queries to one site."""
    return Client(url, token=token, site=site)
