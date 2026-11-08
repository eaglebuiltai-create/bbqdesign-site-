"""Small stand-ins for Gamma markets and CLOB books."""

from __future__ import annotations

from decimal import Decimal
from types import SimpleNamespace


def level(price: str, size: str) -> SimpleNamespace:
    return SimpleNamespace(price=Decimal(price), size=Decimal(size))


def outcome(*, token_id: str | None = None, position_id: str | None = None) -> SimpleNamespace:
    return SimpleNamespace(token_id=token_id, position_id=position_id)


def market(
    *,
    market_id: str = "1",
    question: str = "Will it rain?",
    slug: str = "will-it-rain",
    event_slug: str = "will-it-rain",
    version: str = "v1",
    yes_token: str | None = "yes-token",
    no_token: str | None = "no-token",
    yes_position: str | None = None,
    no_position: str | None = None,
    liquidity: str | None = "5000",
    volume_24hr: str | None = "100",
    best_bid: str | None = "0.40",
    best_ask: str | None = "0.42",
    active: bool | None = True,
    closed: bool | None = False,
    accepting_orders: bool | None = True,
    enable_order_book: bool | None = True,
) -> SimpleNamespace:
    return SimpleNamespace(
        id=market_id,
        question=question,
        slug=slug,
        version=version,
        condition_id="0xabc",
        outcomes=SimpleNamespace(
            yes=outcome(token_id=yes_token, position_id=yes_position),
            no=outcome(token_id=no_token, position_id=no_position),
        ),
        metrics=SimpleNamespace(
            liquidity=None if liquidity is None else Decimal(liquidity),
            liquidity_num=None if liquidity is None else Decimal(liquidity),
            volume_24hr=None if volume_24hr is None else Decimal(volume_24hr),
        ),
        prices=SimpleNamespace(
            best_bid=None if best_bid is None else Decimal(best_bid),
            best_ask=None if best_ask is None else Decimal(best_ask),
            spread=None,
            last_trade_price=Decimal("0.41"),
        ),
        state=SimpleNamespace(
            active=active,
            closed=closed,
            accepting_orders=accepting_orders,
            enable_order_book=enable_order_book,
            end_date=None,
        ),
        events=(SimpleNamespace(slug=event_slug),),
    )


def book(
    *,
    asset_id: str = "yes-token",
    bids: tuple[SimpleNamespace, ...] | None = None,
    asks: tuple[SimpleNamespace, ...] | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        asset_id=asset_id,
        bids=bids if bids is not None else (level("0.10", "5"), level("0.40", "10")),
        asks=asks if asks is not None else (level("0.90", "5"), level("0.44", "8")),
        tick_size=Decimal("0.01"),
        min_order_size=Decimal("5"),
        hash="abc123",
    )


class FakePaginator:
    def __init__(self, items: list[object]) -> None:
        self._items = items

    def iter_items(self):
        yield from self._items


class FakeReader:
    def __init__(self, items: list[object], books: dict[str, object] | None = None) -> None:
        self.items = items
        self.books = books or {}
        self.list_kwargs: dict[str, object] | None = None
        self.book_calls: list[str] = []

    def list_markets(self, **kwargs: object) -> FakePaginator:
        self.list_kwargs = kwargs
        return FakePaginator(self.items)

    def get_order_book(self, *, asset_id: str) -> object:
        self.book_calls.append(asset_id)
        if asset_id not in self.books:
            raise AssertionError(f"unexpected book read {asset_id}")
        book_or_error = self.books[asset_id]
        if isinstance(book_or_error, Exception):
            raise book_or_error
        return book_or_error
