"""AEI research packages, API client and analysis helpers (D-024, D-061)."""

from aei.client import AeiApiError, Client, Project, connect
from aei.package import Package, VerifyResult, read_package, reproduce
from aei.registry import methods_registry

__all__ = ["read_package", "reproduce", "methods_registry", "connect", "Package", "VerifyResult", "Client", "Project", "AeiApiError"]
