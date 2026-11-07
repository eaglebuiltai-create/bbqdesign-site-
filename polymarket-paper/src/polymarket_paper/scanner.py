"""Read-only scan of active Polymarket markets.

Uses the official ``PublicClient`` surface:

- Gamma listing via ``list_markets`` (``closed=false``, liquidity floor).
- CLOB books via ``get_order_book`` for the first few YES asset ids.

No secure client is constructed.
"""

from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Protocol

from polymarket import PolymarketError, RateLimitError

from polymarket_paper.assets import protocol_version, yes_asset_id
from polymarket_paper.books import book_top
from polymarket_paper.config import ScanConfig
from polymarket_paper.models import MarketSnapshot, ScanResult


class MarketReader(Protocol):
    """The two public reads this scanner is allowed to make."""

    def list_markets(self, **kwargs: Any) -> Any: ...

    def get_order_book(self, *, asset_id: str) -> Any: ...


def _attr(obj: Any, name: str, default: Any = None) -> Any:
    if obj is None:
        return default
    return getattr(obj, name, default)


def _decimal(value: Any) -> Decimal | None:
    if value is None:
        return None
    return Decimal(value)


def _flag(value: Any) -> bool | None:
    if value is None:
        return None
    return bool(value)


def is_scannable(market: Any) -> bool:
    """Keep markets Gamma still presents as open and tradable.

    ``None`` means the field was absent, so the row is kept and the snapshot
    shows the unknown flag. An explicit false drops the row.
    """

    state = _attr(market, "state")
    if _flag(_attr(state, "closed")) is True:
        return False
    if _flag(_attr(state, "active")) is False:
        return False
    if _flag(_attr(state, "accepting_orders")) is False:
        return False
    if _flag(_attr(state, "enable_order_book")) is False:
        return False
    return True


def snapshot_from_market(market: Any, *, min_liquidity_usdc: Decimal) -> MarketSnapshot:
    metrics = _attr(market, "metrics")
    prices = _attr(market, "prices")
    state = _attr(market, "state")
    events = _attr(market, "events") or ()
    event_slug = None
    if events:
        event_slug = _attr(events[0], "slug")
    liquidity = _decimal(_attr(metrics, "liquidity"))
    if liquidity is None:
        liquidity = _decimal(_attr(metrics, "liquidity_num"))
    return MarketSnapshot(
        market_id=str(_attr(market, "id", "")),
        question=_attr(market, "question"),
        slug=_attr(market, "slug"),
        event_slug=event_slug,
        condition_id=_text_id(_attr(market, "condition_id")),
        version=protocol_version(market),
        yes_asset_id=yes_asset_id(market),
        active=_flag(_attr(state, "active")),
        accepting_orders=_flag(_attr(state, "accepting_orders")),
        enable_order_book=_flag(_attr(state, "enable_order_book")),
        end_date=_attr(state, "end_date"),
        liquidity_usdc=liquidity,
        volume_24hr_usdc=_decimal(_attr(metrics, "volume_24hr")),
        gamma_best_bid=_decimal(_attr(prices, "best_bid")),
        gamma_best_ask=_decimal(_attr(prices, "best_ask")),
        gamma_spread=_decimal(_attr(prices, "spread")),
        gamma_last_trade_price=_decimal(_attr(prices, "last_trade_price")),
        liquidity_ok=liquidity is not None and liquidity >= min_liquidity_usdc,
    )


def _text_id(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _error_text(exc: PolymarketError) -> str:
    text = str(exc).strip() or exc.__class__.__name__
    if len(text) > 200:
        return text[:200]
    return text


def scan_markets(client: MarketReader, config: ScanConfig) -> ScanResult:
    """List liquid open markets and optionally read a few YES books."""

    paginator = client.list_markets(
        closed=False,
        liquidity_num_min=float(config.min_liquidity_usdc),
        order="liquidity",
        ascending=False,
        version=list(config.versions),
        page_size=min(100, max(config.limit, 1)),
    )
    kept: list[Any] = []
    examined = 0
    for market in paginator.iter_items():
        examined += 1
        if is_scannable(market):
            kept.append(market)
        if len(kept) >= config.limit or examined >= config.max_examined:
            break

    snapshots = [
        snapshot_from_market(market, min_liquidity_usdc=config.min_liquidity_usdc)
        for market in kept
    ]
    enriched: list[MarketSnapshot] = []
    book_reads = 0
    book_attempts = 0
    rate_limited = False
    for snapshot in snapshots:
        if rate_limited or book_attempts >= config.book_reads or snapshot.yes_asset_id is None:
            enriched.append(snapshot)
            continue
        book_attempts += 1
        try:
            book = client.get_order_book(asset_id=snapshot.yes_asset_id)
        except RateLimitError as exc:
            rate_limited = True
            enriched.append(replace(snapshot, book_error=_error_text(exc)))
            continue
        except PolymarketError as exc:
            enriched.append(replace(snapshot, book_error=_error_text(exc)))
            continue
        book_reads += 1
        enriched.append(replace(snapshot, book=book_top(book)))

    return ScanResult(
        mode=config.mode,
        scanned_at=datetime.now(timezone.utc),
        min_liquidity_usdc=config.min_liquidity_usdc,
        examined=examined,
        markets=tuple(enriched),
        book_reads=book_reads,
        rate_limited=rate_limited,
    )
