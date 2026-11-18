from decimal import Decimal

from polymarket import PolymarketError, RateLimitError

from polymarket_paper.config import ScanConfig
from polymarket_paper.logging_json import iter_records
from polymarket_paper.scanner import scan_markets
from tests.fakes import FakeReader, book, market


def _config(**overrides: object) -> ScanConfig:
    raw: dict[str, object] = {"limit": 10, "book_reads": 2, "min_liquidity_usdc": Decimal("1000")}
    raw.update(overrides)
    return ScanConfig(**raw)  # type: ignore[arg-type]


def test_scan_filters_and_reads_only_requested_books() -> None:
    rows = [
        market(market_id="closed", closed=True, yes_token="closed-yes", no_token="closed-no"),
        market(market_id="idle", accepting_orders=False, yes_token="idle-yes", no_token="idle-no"),
        market(market_id="nobook", enable_order_book=False, yes_token="nobook-yes", no_token="nobook-no"),
        market(market_id="a", question="First", yes_token="yes-a", no_token="no-a", liquidity="9000"),
        market(market_id="b", question="Second", yes_token="yes-b", no_token="no-b", liquidity="800"),
        market(market_id="c", question="Third", yes_token="yes-c", no_token="no-c"),
    ]
    reader = FakeReader(
        rows,
        {
            "yes-a": book(asset_id="yes-a"),
            "yes-b": book(asset_id="yes-b"),
            "yes-c": book(asset_id="yes-c"),
        },
    )
    result = scan_markets(reader, _config())

    assert reader.list_kwargs is not None
    assert reader.list_kwargs["closed"] is False
    assert reader.list_kwargs["order"] == "liquidity"
    assert reader.list_kwargs["ascending"] is False
    assert reader.list_kwargs["liquidity_num_min"] == 1000.0
    assert reader.list_kwargs["version"] == ["v1", "v2"]
    assert [item.market_id for item in result.markets] == ["a", "b", "c"]
    assert reader.book_calls == ["yes-a", "yes-b"]
    assert result.book_reads == 2
    assert result.markets[0].book is not None
    assert result.markets[0].book.best_bid == Decimal("0.40")
    assert result.markets[0].liquidity_ok is True
    assert result.markets[1].liquidity_ok is False
    assert result.markets[1].book is not None
    assert result.markets[2].book is None
    assert result.markets[0].url == "https://polymarket.com/event/will-it-rain"
    assert result.examined == 6

    records = iter_records(result)
    assert records[0]["type"] == "scan"
    assert records[0]["mode"] == "paper"
    assert "markets" not in records[0]
    assert records[1]["type"] == "market"
    assert records[1]["gamma_best_bid"] == "0.40"
    assert records[1]["book"]["best_ask"] == "0.44"


def test_book_error_counts_as_an_attempt_and_rate_limit_stops() -> None:
    rows = [
        market(market_id="a", yes_token="yes-a", no_token="no-a"),
        market(market_id="b", yes_token="yes-b", no_token="no-b"),
        market(market_id="c", yes_token="yes-c", no_token="no-c"),
    ]
    reader = FakeReader(
        rows,
        {
            "yes-a": PolymarketError("book missing"),
            "yes-b": RateLimitError("slow down"),
            "yes-c": book(asset_id="yes-c"),
        },
    )
    result = scan_markets(reader, _config(book_reads=5))
    assert reader.book_calls == ["yes-a", "yes-b"]
    assert result.book_reads == 0
    assert result.rate_limited is True
    assert result.markets[0].book_error == "book missing"
    assert result.markets[1].book_error == "slow down"
    assert result.markets[2].book is None


def test_limit_stops_pagination() -> None:
    rows = [market(market_id=str(i), yes_token=f"yes-{i}", no_token=f"no-{i}") for i in range(5)]
    reader = FakeReader(rows, {})
    result = scan_markets(reader, _config(limit=2, book_reads=0))
    assert [item.market_id for item in result.markets] == ["0", "1"]
    assert reader.book_calls == []
    assert result.examined == 2
