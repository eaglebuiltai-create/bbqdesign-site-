from decimal import Decimal

from polymarket_paper.assets import yes_asset_id
from polymarket_paper.books import book_top
from tests.fakes import book, level, market


def test_v1_token_pair_wins_when_both_ids_exist() -> None:
    row = market(yes_token="token-yes", no_token="token-no", yes_position="pos-yes", no_position="pos-no")
    assert yes_asset_id(row) == "token-yes"


def test_v2_position_pair_when_tokens_are_absent() -> None:
    row = market(
        version="v2",
        yes_token=None,
        no_token=None,
        yes_position="pos-yes",
        no_position="pos-no",
    )
    assert yes_asset_id(row) == "pos-yes"


def test_missing_outcome_pair_has_no_asset() -> None:
    row = market(yes_token="only-yes", no_token=None, yes_position=None, no_position=None)
    assert yes_asset_id(row) is None


def test_best_prices_are_the_last_book_levels() -> None:
    top = book_top(
        book(
            bids=(level("0.10", "100"), level("0.40", "2")),
            asks=(level("0.90", "100"), level("0.44", "3")),
        )
    )
    assert top.best_bid == Decimal("0.40")
    assert top.best_bid_size == Decimal("2")
    assert top.best_ask == Decimal("0.44")
    assert top.best_ask_size == Decimal("3")
    assert top.midpoint == Decimal("0.42")
    assert top.bid_notional_usdc == Decimal("10.0") + Decimal("0.80")
    assert top.ask_notional_usdc == Decimal("90.0") + Decimal("1.32")


def test_empty_book_has_no_midpoint() -> None:
    top = book_top(book(bids=(), asks=()))
    assert top.best_bid is None
    assert top.best_ask is None
    assert top.midpoint is None
    assert top.bid_notional_usdc == Decimal("0")
