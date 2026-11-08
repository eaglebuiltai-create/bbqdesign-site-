from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

import pytest

from polymarket_paper.__main__ import main, render_table
from polymarket_paper.books import book_top
from polymarket_paper.mode import ResearchModeError, assert_research_mode
from polymarket_paper.models import MarketSnapshot, ScanResult
from polymarket_paper.risk import Proposal, RiskLimits, RiskState, evaluate
from tests.fakes import book, level


def test_research_modes() -> None:
    assert assert_research_mode(" Paper ") == "paper"
    assert assert_research_mode("shadow") == "shadow"
    with pytest.raises(ResearchModeError):
        assert_research_mode("live")


def test_live_environment_never_opens_a_client(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("POLYMARKET_MODE", "live")

    def fail_if_called(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("PublicClient should not be constructed")

    monkeypatch.setattr("polymarket_paper.__main__.PublicClient", fail_if_called)
    assert main(["scan", "--limit", "1"]) == 2


def test_bad_version_is_rejected_before_a_client(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail_if_called(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("PublicClient should not be constructed")

    monkeypatch.setattr("polymarket_paper.__main__.PublicClient", fail_if_called)
    assert main(["scan", "--versions", "v3", "--limit", "1"]) == 2


def test_risk_bands_are_closed() -> None:
    with pytest.raises(ValueError):
        RiskLimits(max_fraction_per_market=Decimal("0.05"))
    with pytest.raises(ValueError):
        RiskLimits(max_open_positions=11)
    with pytest.raises(ValueError):
        RiskLimits(max_open_positions=4)
    with pytest.raises(ValueError):
        RiskLimits(daily_loss_fraction=Decimal("0"))


def test_evaluate_blocks_size_count_loss_liquidity_and_edge() -> None:
    limits = RiskLimits()
    base = Proposal(market_id="m", notional_usdc=Decimal("20"), liquidity_usdc=Decimal("1000"), edge=Decimal("0.03"))
    assert evaluate(base, RiskState(), limits).allowed is True

    oversized = evaluate(
        Proposal(market_id="m", notional_usdc=Decimal("20.01"), liquidity_usdc=Decimal("1000"), edge=Decimal("0.03")),
        RiskState(),
        limits,
    )
    assert oversized.reasons == ("notional_over_market_cap",)

    crowded = evaluate(base, RiskState(open_positions=8), limits)
    assert crowded.reasons == ("open_position_cap",)
    added = evaluate(base, RiskState(open_positions=8), limits, opening_new=False)
    assert added.allowed is True
    over_cap = evaluate(base, RiskState(open_positions=9), limits, opening_new=False)
    assert over_cap.reasons == ("open_position_cap",)

    stopped = evaluate(base, RiskState(daily_pnl_usdc=Decimal("-50")), limits)
    assert stopped.reasons == ("daily_loss_breaker",)

    thin = evaluate(
        Proposal(market_id="m", notional_usdc=Decimal("10"), liquidity_usdc=Decimal("999"), edge=Decimal("0.03")),
        RiskState(),
        limits,
    )
    assert thin.reasons == ("liquidity_below_minimum",)

    small_edge = evaluate(
        Proposal(market_id="m", notional_usdc=Decimal("10"), liquidity_usdc=Decimal("1000"), edge=Decimal("0.029")),
        RiskState(),
        limits,
    )
    assert small_edge.reasons == ("edge_below_minimum",)

    missing = evaluate(
        Proposal(market_id="m", notional_usdc=Decimal("10"), liquidity_usdc=Decimal("1000")),
        RiskState(),
        limits,
        require_edge=True,
    )
    assert missing.allowed is False
    assert "edge_missing" in missing.reasons


def test_table_marks_a_one_sided_book() -> None:
    top = book_top(book(bids=(), asks=(level("0.01", "100"),)))
    snapshot = MarketSnapshot(
        market_id="1",
        question="One sided",
        slug="one-sided",
        event_slug=None,
        condition_id=None,
        version="v1",
        yes_asset_id="yes-token",
        active=True,
        accepting_orders=True,
        enable_order_book=True,
        end_date=None,
        liquidity_usdc=Decimal("1000"),
        volume_24hr_usdc=None,
        gamma_best_bid=None,
        gamma_best_ask=Decimal("0.01"),
        gamma_spread=None,
        gamma_last_trade_price=None,
        liquidity_ok=True,
        book=top,
    )
    result = ScanResult(
        mode="paper",
        scanned_at=datetime(2026, 11, 7, 22, 42, tzinfo=timezone.utc),
        min_liquidity_usdc=Decimal("1000"),
        examined=1,
        markets=(snapshot,),
        book_reads=1,
        rate_limited=False,
    )
    table = render_table(result)
    assert "one-sided" in table
    assert "PST" in table


def test_package_source_has_no_trading_surface() -> None:
    root = Path(__file__).resolve().parents[1] / "src"
    banned = (
        "SecureClient",
        "private_key",
        "POLYMARKET_PRIVATE_KEY",
        "place_order",
        "post_order",
        "create_order",
        "sign_typed",
        "eth_account",
    )
    for path in root.rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        for token in banned:
            assert token not in text, f"{path} contains {token}"
