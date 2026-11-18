from datetime import datetime, timezone
from decimal import Decimal

from polymarket_paper.edges import annotate_edges, assess_market
from polymarket_paper.fair import calibrate_yes
from polymarket_paper.models import BookTop, MarketSnapshot, ScanResult
from polymarket_paper.risk import RiskLimits, RiskState


def test_calibration_is_flat_at_one_half_and_pulls_the_tails() -> None:
    assert calibrate_yes(Decimal("0.50")) == Decimal("0.500000")
    low = calibrate_yes(Decimal("0.20"))
    high = calibrate_yes(Decimal("0.80"))
    assert low < Decimal("0.20")
    assert high > Decimal("0.80")
    assert abs(low - Decimal("0.20")) >= Decimal("0.03")
    assert abs(Decimal("0.40") - calibrate_yes(Decimal("0.40"))) < Decimal("0.03")


def _market(
    *,
    bid: str | None,
    ask: str | None,
    liquidity: str = "5000",
    book: BookTop | None = None,
    market_id: str = "m",
) -> MarketSnapshot:
    return MarketSnapshot(
        market_id=market_id,
        question="Will it rain?",
        slug="rain",
        event_slug="rain",
        condition_id=None,
        version="v1",
        yes_asset_id="yes",
        active=True,
        accepting_orders=True,
        enable_order_book=True,
        end_date=None,
        liquidity_usdc=None if liquidity == "" else Decimal(liquidity),
        volume_24hr_usdc=None,
        gamma_best_bid=None if bid is None else Decimal(bid),
        gamma_best_ask=None if ask is None else Decimal(ask),
        gamma_spread=None,
        gamma_last_trade_price=None,
        liquidity_ok=liquidity not in {"", "100"},
        book=book,
    )


def _book(bid: str, ask: str) -> BookTop:
    return BookTop(
        asset_id="yes",
        best_bid=Decimal(bid),
        best_bid_size=Decimal("10"),
        best_ask=Decimal(ask),
        best_ask_size=Decimal("10"),
        midpoint=(Decimal(bid) + Decimal(ask)) / Decimal("2"),
        bid_notional_usdc=Decimal("1"),
        ask_notional_usdc=Decimal("1"),
        tick_size=Decimal("0.01"),
        min_order_size=Decimal("5"),
        book_hash="h",
        bid_levels=1,
        ask_levels=1,
    )


def test_longshot_quote_flags_buy_no_when_risk_is_clear() -> None:
    assessed = assess_market(_market(bid="0.19", ask="0.21"), RiskLimits(), RiskState())
    assert assessed.quote_source == "gamma"
    assert assessed.flag == "buy_no"
    assert assessed.edge is not None and assessed.edge < 0
    assert assessed.flag_reasons == ()


def test_favorite_quote_flags_buy_yes() -> None:
    assessed = assess_market(_market(bid="0.79", ask="0.81"), RiskLimits(), RiskState())
    assert assessed.flag == "buy_yes"
    assert assessed.edge is not None and assessed.edge > 0


def test_small_gap_liquidity_spread_and_risk_do_not_flag() -> None:
    near = assess_market(_market(bid="0.39", ask="0.41"), RiskLimits(), RiskState())
    assert near.flag is None
    assert near.flag_reasons == ("edge_below_minimum",)

    thin = assess_market(_market(bid="0.19", ask="0.21", liquidity="100"), RiskLimits(), RiskState())
    assert thin.flag is None
    assert "liquidity_below_minimum" in thin.flag_reasons

    wide = assess_market(_market(bid="0.10", ask="0.30"), RiskLimits(), RiskState())
    assert wide.flag is None
    assert wide.flag_reasons == ("spread_too_wide",)
    assert wide.fair_yes is not None

    one_sided = assess_market(_market(bid=None, ask="0.20"), RiskLimits(), RiskState())
    assert one_sided.flag is None
    assert one_sided.flag_reasons == ("no_two_sided_quote",)

    blocked = assess_market(
        _market(bid="0.19", ask="0.21"),
        RiskLimits(),
        RiskState(open_positions=8),
    )
    assert blocked.flag is None
    assert blocked.flag_reasons == ("open_position_cap",)

    stopped = assess_market(
        _market(bid="0.19", ask="0.21"),
        RiskLimits(),
        RiskState(daily_pnl_usdc=Decimal("-50")),
    )
    assert stopped.flag is None
    assert "daily_loss_breaker" in stopped.flag_reasons


def test_clob_quote_beats_gamma_and_annotation_counts_flags() -> None:
    market = _market(bid="0.49", ask="0.51", book=_book("0.19", "0.21"))
    assessed = assess_market(market, RiskLimits(), RiskState())
    assert assessed.quote_source == "clob"
    assert assessed.flag == "buy_no"
    result = ScanResult(
        mode="paper",
        scanned_at=datetime(2026, 11, 8, 15, tzinfo=timezone.utc),
        min_liquidity_usdc=Decimal("1000"),
        examined=1,
        markets=(market,),
        book_reads=1,
        rate_limited=False,
    )
    annotated = annotate_edges(result)
    assert annotated.markets[0].flag == "buy_no"
    assert annotated.to_json()["flagged"] == 1
    assert result.markets[0].flag is None
