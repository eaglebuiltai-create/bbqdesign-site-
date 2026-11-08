import json
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from polymarket_paper.__main__ import main
from polymarket_paper.ledger import LedgerError, PaperBook, load_book
from polymarket_paper.risk import Decision

PACIFIC = ZoneInfo("America/Los_Angeles")
NOW = datetime(2026, 11, 8, 9, 0, tzinfo=PACIFIC)


def _buy(book: PaperBook, market_id: str = "m", notional: str = "10", **overrides: object) -> object:
    raw: dict[str, object] = {
        "mode": "paper",
        "market_id": market_id,
        "outcome": "yes",
        "notional_usdc": Decimal(notional),
        "price": Decimal("0.50"),
        "liquidity_usdc": Decimal("5000"),
        "now": NOW,
    }
    raw.update(overrides)
    return book.propose_buy(**raw)  # type: ignore[arg-type]


def test_buy_is_recorded_only_after_risk_passes() -> None:
    book = PaperBook.new(now=NOW)
    recorded = _buy(book)
    assert recorded.recorded is True
    assert recorded.label == "recorded"
    assert book.cash_usdc == Decimal("990")
    assert book.open_position_count() == 1
    assert book.positions[0].shares == Decimal("20")
    assert len(book.fills) == 1

    refused = _buy(book, market_id="other", notional="25")
    assert refused.recorded is False
    assert refused.reasons == ("notional_over_market_cap",)
    assert book.cash_usdc == Decimal("990")
    assert len(book.fills) == 1


def test_evaluate_refusal_blocks_the_book(monkeypatch: pytest.MonkeyPatch) -> None:
    def refuse(*_args: object, **_kwargs: object) -> Decision:
        return Decision(False, ("notional_over_market_cap",), Decimal("20"), False)

    monkeypatch.setattr("polymarket_paper.ledger.evaluate", refuse)
    book = PaperBook.new(now=NOW)
    result = _buy(book)
    assert result.recorded is False
    assert book.fills == []
    assert book.cash_usdc == Decimal("1000")


def test_cash_short_blocks_even_when_risk_allows(monkeypatch: pytest.MonkeyPatch) -> None:
    def allow(*_args: object, **_kwargs: object) -> Decision:
        return Decision(True, (), Decimal("20"), False)

    monkeypatch.setattr("polymarket_paper.ledger.evaluate", allow)
    book = PaperBook.new(now=NOW)
    book.cash_usdc = Decimal("5")
    result = _buy(book)
    assert result.recorded is False
    assert result.reasons == ("cash_short",)
    assert book.cash_usdc == Decimal("5")


def test_position_cap_blocks_a_new_market_and_allows_an_add() -> None:
    book = PaperBook.new(now=NOW)
    for index in range(8):
        result = _buy(book, market_id=f"m{index}", notional="1")
        assert result.recorded is True
    blocked = _buy(book, market_id="new", notional="1")
    assert blocked.reasons == ("open_position_cap",)
    added = _buy(book, market_id="m0", notional="1")
    assert added.recorded is True
    assert book.open_position_count() == 8
    assert book.find("m0", "yes").cost_usdc == Decimal("2")


def test_per_market_cap_counts_both_outcomes() -> None:
    book = PaperBook.new(now=NOW)
    assert _buy(book, notional="15").recorded is True
    second = _buy(book, notional="6")
    assert second.recorded is False
    other_side = _buy(book, outcome="no", notional="6")
    assert "notional_over_market_cap" in other_side.reasons
    assert book.cash_usdc == Decimal("985")
    assert book.open_position_count() == 1


def test_shadow_does_not_change_the_book() -> None:
    book = PaperBook.new(now=NOW)
    result = _buy(book, mode="shadow")
    assert result.allowed is True
    assert result.recorded is False
    assert result.label == "allowed_not_recorded"
    assert book.cash_usdc == Decimal("1000")
    assert book.positions == []
    assert book.fills == []


def test_edge_and_price_and_liquidity_gates() -> None:
    book = PaperBook.new(now=NOW)
    missing = _buy(book, require_edge=True)
    assert missing.reasons == ("edge_missing",)
    small = _buy(book, edge=Decimal("0.02"))
    assert small.reasons == ("edge_below_minimum",)
    thin = _buy(book, liquidity_usdc=Decimal("999"))
    assert thin.reasons == ("liquidity_below_minimum",)
    priced = _buy(book, price=Decimal("1"))
    assert "price_out_of_range" in priced.reasons
    assert book.fills == []
    recorded = _buy(book, edge=Decimal("0.03"))
    assert recorded.recorded is True


def test_mark_trips_breaker_and_close_still_records() -> None:
    book = PaperBook.new(now=NOW)
    for index in range(3):
        assert _buy(book, market_id=str(index), notional="20").recorded is True
        marked = book.mark(mode="paper", market_id=str(index), outcome="yes", price=Decimal("0"), now=NOW)
        assert marked.recorded is True
    assert book.daily_pnl_usdc() == Decimal("-60")
    assert book.breaker_tripped() is True
    blocked = _buy(book, market_id="fresh", notional="1")
    assert "daily_loss_breaker" in blocked.reasons
    closed = book.close_position(
        mode="paper",
        market_id="0",
        outcome="yes",
        price=Decimal("0"),
        now=NOW,
    )
    assert closed.recorded is True
    assert book.find("0", "yes") is None
    assert book.cash_usdc == Decimal("940")
    still_blocked = _buy(book, market_id="fresh", notional="1")
    assert still_blocked.recorded is False


def test_profitable_close_returns_cash() -> None:
    book = PaperBook.new(now=NOW)
    assert _buy(book, price=Decimal("0.40")).recorded is True
    closed = book.close_position(
        mode="paper",
        market_id="m",
        outcome="yes",
        price=Decimal("0.60"),
        now=NOW,
    )
    assert closed.recorded is True
    assert closed.fill is not None
    assert closed.fill.realized_usdc == Decimal("5")
    assert book.cash_usdc == Decimal("1005")
    assert book.positions == []
    assert book.daily_pnl_usdc() == Decimal("5")


def test_day_roll_resets_the_breaker() -> None:
    book = PaperBook.new(now=datetime(2026, 11, 7, 15, tzinfo=PACIFIC))
    book.realized_today_usdc = Decimal("-50")
    refused = _buy(book, now=datetime(2026, 11, 7, 16, tzinfo=PACIFIC))
    assert "daily_loss_breaker" in refused.reasons
    allowed = _buy(book, now=datetime(2026, 11, 8, 9, tzinfo=PACIFIC))
    assert allowed.recorded is True
    assert book.day.isoformat() == "2026-11-08"
    assert book.realized_today_usdc == Decimal("0")


def test_book_roundtrip_and_tamper_rejection(tmp_path) -> None:
    path = tmp_path / "book.json"
    book = PaperBook.new(now=NOW)
    assert _buy(book, question="Will it rain?").recorded is True
    book.save(path)
    loaded = load_book(path)
    assert loaded.cash_usdc == Decimal("990")
    assert loaded.positions[0].question == "Will it rain?"
    assert loaded.positions[0].shares == Decimal("20")
    assert loaded.fills[0].fill_id == 1

    raw = json.loads(path.read_text(encoding="utf-8"))
    raw["limits"]["max_fraction_per_market"] = "0.50"
    path.write_text(json.dumps(raw), encoding="utf-8")
    with pytest.raises(LedgerError):
        load_book(path)


def test_cli_records_a_buy_and_refuses_an_oversized_one(tmp_path, capsys: pytest.CaptureFixture[str]) -> None:
    path = tmp_path / "book.json"
    assert main(["ledger", "init", "--ledger", str(path)]) == 0
    assert main(
        [
            "ledger",
            "propose",
            "--ledger",
            str(path),
            "--market-id",
            "m",
            "--outcome",
            "yes",
            "--notional",
            "10",
            "--price",
            "0.40",
            "--liquidity",
            "5000",
        ]
    ) == 0
    assert load_book(path).cash_usdc == Decimal("990")
    audit = path.with_suffix(".jsonl").read_text(encoding="utf-8")
    assert '"recorded":true' in audit

    assert main(
        [
            "ledger",
            "propose",
            "--ledger",
            str(path),
            "--market-id",
            "other",
            "--outcome",
            "yes",
            "--notional",
            "25",
            "--price",
            "0.40",
            "--liquidity",
            "5000",
        ]
    ) == 0
    captured = capsys.readouterr()
    assert "decision=refused" in captured.out
    assert load_book(path).cash_usdc == Decimal("990")
    assert load_book(path).open_position_count() == 1


def test_cli_shadow_and_live_do_not_write_a_fill(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    path = tmp_path / "book.json"
    assert main(["ledger", "init", "--ledger", str(path)]) == 0
    assert main(
        [
            "ledger",
            "propose",
            "--ledger",
            str(path),
            "--mode",
            "shadow",
            "--market-id",
            "m",
            "--outcome",
            "no",
            "--notional",
            "10",
            "--price",
            "0.40",
            "--liquidity",
            "5000",
        ]
    ) == 0
    assert load_book(path).positions == []
    shadow_log = path.with_suffix(".jsonl").read_text(encoding="utf-8")
    assert '"label":"allowed_not_recorded"' in shadow_log

    monkeypatch.setenv("POLYMARKET_MODE", "live")
    live_path = tmp_path / "live.json"
    assert main(["ledger", "init", "--ledger", str(live_path)]) == 2
    assert not live_path.exists()


def test_loose_limits_are_rejected_before_a_book_is_created(tmp_path) -> None:
    path = tmp_path / "book.json"
    assert main(["ledger", "init", "--ledger", str(path), "--max-fraction", "0.5"]) == 2
    assert not path.exists()


def test_ledger_source_does_not_touch_the_network() -> None:
    text = (
        Path(__file__).resolve().parents[1] / "src" / "polymarket_paper" / "ledger.py"
    ).read_text(encoding="utf-8")
    assert "PublicClient" not in text
    assert "import polymarket" not in text
