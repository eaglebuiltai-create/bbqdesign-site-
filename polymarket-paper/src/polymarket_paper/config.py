"""Scan settings.

Liquidity, page size, and how many CLOB books to read are scanner settings.
Position and loss caps live on ``RiskLimits`` and are not applied to orders
in this slice: nothing here submits an order.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True, slots=True)
class ScanConfig:
    """What one read-only scan is allowed to request."""

    mode: str = "paper"
    limit: int = 20
    min_liquidity_usdc: Decimal = Decimal("1000")
    book_reads: int = 5
    versions: tuple[str, ...] = ("v1", "v2")
    max_examined: int = 200

    def __post_init__(self) -> None:
        if self.mode not in {"paper", "shadow"}:
            raise ValueError("mode must be paper or shadow")
        if self.limit < 1:
            raise ValueError("limit must be at least 1")
        if self.min_liquidity_usdc < 0:
            raise ValueError("min_liquidity_usdc cannot be negative")
        if self.book_reads < 0:
            raise ValueError("book_reads cannot be negative")
        if self.max_examined < self.limit:
            raise ValueError("max_examined must be at least limit")
        if not self.versions:
            raise ValueError("versions must include v1, v2, or both")
        unknown = [version for version in self.versions if version not in {"v1", "v2"}]
        if unknown:
            raise ValueError(f"unknown protocol versions: {unknown}")
