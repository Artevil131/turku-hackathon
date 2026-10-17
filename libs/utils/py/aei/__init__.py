"""AEI research packages, API client and analysis helpers (D-024, D-061)."""

from aei.client import AeiApiError, Client, Project, connect
from aei.package import Package, VerifyResult, read_package, reproduce

__all__ = ["read_package", "reproduce", "connect", "Package", "VerifyResult", "Client", "Project", "AeiApiError"]
