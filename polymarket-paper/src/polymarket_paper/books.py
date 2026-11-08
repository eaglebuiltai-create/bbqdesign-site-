"""Read the top of a CLOB order book.

This module only interprets a book the caller already fetched. It does not
place or cancel anything.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from polymarket_paper.models import BookTop


def _level(levels: Any, index: int) -> Any | None:
    if not levels:
        return None
    try:
        return levels[index]
    except (IndexError, TypeError):
        return None


def _notional(levels: Any) -> Decimal:
    total = Decimal("0")
    for level in levels or ():
        price = getattr(level, "price", None)
        size = getattr(level, "size", None)
        if price is None or size is None:
            continue
        total += Decimal(price) * Decimal(size)
    return total


def book_top(book: Any) -> BookTop:
    """Summarize one order book.

    Bids are ascending and asks are descending, so the best price on each
    side is the last level:
    https://docs.polymarket.com/market-data/prices-order-books
    """

    bids = getattr(book, "bids", ()) or ()
    asks = getattr(book, "asks", ()) or ()
    best_bid = _level(bids, -1)
    best_ask = _level(asks, -1)
    bid_price = None if best_bid is None else Decimal(best_bid.price)
    ask_price = None if best_ask is None else Decimal(best_ask.price)
    midpoint = None
    if bid_price is not None and ask_price is not None:
        midpoint = (bid_price + ask_price) / Decimal("2")
    return BookTop(
        asset_id=str(getattr(book, "asset_id", "")),
        best_bid=bid_price,
        best_bid_size=None if best_bid is None else Decimal(best_bid.size),
        best_ask=ask_price,
        best_ask_size=None if best_ask is None else Decimal(best_ask.size),
        midpoint=midpoint,
        bid_notional_usdc=_notional(bids),
        ask_notional_usdc=_notional(asks),
        tick_size=Decimal(getattr(book, "tick_size")),
        min_order_size=Decimal(getattr(book, "min_order_size")),
        book_hash=str(getattr(book, "hash", "")),
        bid_levels=len(bids),
        ask_levels=len(asks),
    )
