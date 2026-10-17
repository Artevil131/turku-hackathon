"""AEI research packages, API client and analysis helpers (D-024, D-061)."""

from aei.client import AeiApiError, Client, Project, connect
from aei.package import Package, read_package

__all__ = ["read_package", "connect", "Package", "Client", "Project", "AeiApiError"]
