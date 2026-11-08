"""Flag a paper row when the baseline disagrees with a two-sided quote.

A flag is not an order. It requires a quote, a spread of 5 cents or less,
an absolute gap of at least the risk floor, enough liquidity, and a clear
daily-loss and position state.
"""

from __future__ import annotations

from dataclasses import replace
from decimal import Decimal

from polymarket_paper.fair import calibrate_yes
from polymarket_paper.models import MarketSnapshot, ScanResult
from polymarket_paper.risk import Proposal, RiskLimits, RiskState, evaluate

MAX_SPREAD = Decimal("0.05")


def quoted_yes(market: MarketSnapshot) -> tuple[Decimal, Decimal, str] | None:
    """Return midpoint, spread, and source for a two-sided YES quote.

    The CLOB book wins when both sides are present. Otherwise Gamma's best
    bid and ask are used. One-sided quotes are skipped.
    """

    book = market.book
    if book is not None and book.best_bid is not None and book.best_ask is not None:
        if book.best_ask > book.best_bid and book.midpoint is not None:
            return book.midpoint, book.best_ask - book.best_bid, "clob"
    bid = market.gamma_best_bid
    ask = market.gamma_best_ask
    if bid is not None and ask is not None and ask > bid:
        return (bid + ask) / Decimal("2"), ask - bid, "gamma"
    return None


def assess_market(
    market: MarketSnapshot,
    limits: RiskLimits,
    state: RiskState,
) -> MarketSnapshot:
    """Attach a fair value, an edge, and a flag to one snapshot."""

    quote = quoted_yes(market)
    if quote is None:
        return replace(
            market,
            fair_yes=None,
            quoted_yes=None,
            quote_source=None,
            edge=None,
            flag=None,
            flag_reasons=("no_two_sided_quote",),
        )
    mid, spread, source = quote
    if mid <= 0 or mid >= 1:
        return replace(
            market,
            fair_yes=None,
            quoted_yes=mid,
            quote_source=source,
            edge=None,
            flag=None,
            flag_reasons=("quote_out_of_range",),
        )
    fair = calibrate_yes(mid)
    edge = fair - mid
    if spread > MAX_SPREAD:
        return replace(
            market,
            fair_yes=fair,
            quoted_yes=mid,
            quote_source=source,
            edge=edge,
            flag=None,
            flag_reasons=("spread_too_wide",),
        )
    decision = evaluate(
        Proposal(
            market_id=market.market_id,
            notional_usdc=limits.max_notional_usdc,
            liquidity_usdc=market.liquidity_usdc,
            edge=edge,
        ),
        state,
        limits,
        require_edge=True,
    )
    flag = None
    if decision.allowed:
        flag = "buy_yes" if edge > 0 else "buy_no"
    return replace(
        market,
        fair_yes=fair,
        quoted_yes=mid,
        quote_source=source,
        edge=edge,
        flag=flag,
        flag_reasons=() if flag else decision.reasons,
    )


def annotate_edges(
    result: ScanResult,
    *,
    limits: RiskLimits | None = None,
    state: RiskState | None = None,
) -> ScanResult:
    """Return a scan whose rows carry fair values and paper flags."""

    chosen_limits = limits or RiskLimits()
    chosen_state = state or RiskState()
    markets = tuple(assess_market(market, chosen_limits, chosen_state) for market in result.markets)
    return replace(result, markets=markets)
