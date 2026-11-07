"""Scan records.

Prices stay as ``Decimal``. JSON output renders them as strings so a log
cannot turn a tick into a binary float.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any


def decimal_string(value: Decimal | None) -> str | None:
    if value is None:
        return None
    return format(value, "f")


@dataclass(frozen=True, slots=True)
class BookTop:
    """Best prices from one CLOB book.

    Official book ordering: bids ascend, asks descend, so the best level is
    the last entry on each side.
    https://docs.polymarket.com/market-data/prices-order-books
    """

    asset_id: str
    best_bid: Decimal | None
    best_bid_size: Decimal | None
    best_ask: Decimal | None
    best_ask_size: Decimal | None
    midpoint: Decimal | None
    bid_notional_usdc: Decimal
    ask_notional_usdc: Decimal
    tick_size: Decimal
    min_order_size: Decimal
    book_hash: str
    bid_levels: int
    ask_levels: int

    def to_json(self) -> dict[str, Any]:
        return {
            "asset_id": self.asset_id,
            "best_bid": decimal_string(self.best_bid),
            "best_bid_size": decimal_string(self.best_bid_size),
            "best_ask": decimal_string(self.best_ask),
            "best_ask_size": decimal_string(self.best_ask_size),
            "midpoint": decimal_string(self.midpoint),
            "bid_notional_usdc": decimal_string(self.bid_notional_usdc),
            "ask_notional_usdc": decimal_string(self.ask_notional_usdc),
            "tick_size": decimal_string(self.tick_size),
            "min_order_size": decimal_string(self.min_order_size),
            "book_hash": self.book_hash,
            "bid_levels": self.bid_levels,
            "ask_levels": self.ask_levels,
        }


@dataclass(frozen=True, slots=True)
class MarketSnapshot:
    """One active market, plus an optional read-only book."""

    market_id: str
    question: str | None
    slug: str | None
    event_slug: str | None
    condition_id: str | None
    version: str | None
    yes_asset_id: str | None
    active: bool | None
    accepting_orders: bool | None
    enable_order_book: bool | None
    end_date: datetime | None
    liquidity_usdc: Decimal | None
    volume_24hr_usdc: Decimal | None
    gamma_best_bid: Decimal | None
    gamma_best_ask: Decimal | None
    gamma_spread: Decimal | None
    gamma_last_trade_price: Decimal | None
    liquidity_ok: bool
    book: BookTop | None = None
    book_error: str | None = None

    @property
    def url(self) -> str | None:
        slug = self.event_slug or self.slug
        if not slug:
            return None
        return f"https://polymarket.com/event/{slug}"

    def to_json(self) -> dict[str, Any]:
        return {
            "market_id": self.market_id,
            "question": self.question,
            "slug": self.slug,
            "event_slug": self.event_slug,
            "url": self.url,
            "condition_id": self.condition_id,
            "version": self.version,
            "yes_asset_id": self.yes_asset_id,
            "active": self.active,
            "accepting_orders": self.accepting_orders,
            "enable_order_book": self.enable_order_book,
            "end_date": None if self.end_date is None else self.end_date.isoformat(),
            "liquidity_usdc": decimal_string(self.liquidity_usdc),
            "volume_24hr_usdc": decimal_string(self.volume_24hr_usdc),
            "gamma_best_bid": decimal_string(self.gamma_best_bid),
            "gamma_best_ask": decimal_string(self.gamma_best_ask),
            "gamma_spread": decimal_string(self.gamma_spread),
            "gamma_last_trade_price": decimal_string(self.gamma_last_trade_price),
            "liquidity_ok": self.liquidity_ok,
            "book": None if self.book is None else self.book.to_json(),
            "book_error": self.book_error,
        }


@dataclass(frozen=True, slots=True)
class ScanResult:
    """A finished read-only scan."""

    mode: str
    scanned_at: datetime
    min_liquidity_usdc: Decimal
    examined: int
    markets: tuple[MarketSnapshot, ...]
    book_reads: int
    rate_limited: bool

    def to_json(self) -> dict[str, Any]:
        return {
            "type": "scan",
            "mode": self.mode,
            "scanned_at": self.scanned_at.isoformat(),
            "min_liquidity_usdc": decimal_string(self.min_liquidity_usdc),
            "examined": self.examined,
            "returned": len(self.markets),
            "book_reads": self.book_reads,
            "rate_limited": self.rate_limited,
            "markets": [market.to_json() for market in self.markets],
        }
