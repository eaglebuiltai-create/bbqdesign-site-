"""Hard risk checks for a future paper fill.

``evaluate`` is a pure function. It does not read the network and it does not
submit orders. A later paper ledger must call it before recording a fill.
This slice has no ledger and no order path.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True, slots=True)
class RiskLimits:
    """Caps that later paper code is not allowed to loosen past these bands.

    Per-market risk stays inside 1–2% of bankroll. Open positions stay inside
    5–10. The daily-loss breaker is required and stays inside 1–10% of
    bankroll; 5% is the default because the request names the breaker without
    a figure.
    """

    bankroll_usdc: Decimal = Decimal("1000")
    max_fraction_per_market: Decimal = Decimal("0.02")
    max_open_positions: int = 8
    daily_loss_fraction: Decimal = Decimal("0.05")
    min_liquidity_usdc: Decimal = Decimal("1000")
    min_edge: Decimal = Decimal("0.03")

    def __post_init__(self) -> None:
        if self.bankroll_usdc <= 0:
            raise ValueError("bankroll_usdc must be positive")
        if not Decimal("0.01") <= self.max_fraction_per_market <= Decimal("0.02"):
            raise ValueError("max_fraction_per_market must stay inside 1% to 2%")
        if not 5 <= self.max_open_positions <= 10:
            raise ValueError("max_open_positions must stay inside 5 to 10")
        if not Decimal("0.01") <= self.daily_loss_fraction <= Decimal("0.10"):
            raise ValueError("daily_loss_fraction must stay inside 1% to 10%")
        if self.min_liquidity_usdc < 0:
            raise ValueError("min_liquidity_usdc cannot be negative")
        if not Decimal("0") < self.min_edge <= Decimal("1"):
            raise ValueError("min_edge must be a probability gap above 0 and at most 1")

    @property
    def max_notional_usdc(self) -> Decimal:
        return self.bankroll_usdc * self.max_fraction_per_market

    @property
    def daily_loss_usdc(self) -> Decimal:
        return self.bankroll_usdc * self.daily_loss_fraction


@dataclass(frozen=True, slots=True)
class RiskState:
    """Paper book the breaker reads. Losses are negative daily PnL."""

    open_positions: int = 0
    daily_pnl_usdc: Decimal = Decimal("0")

    def __post_init__(self) -> None:
        if self.open_positions < 0:
            raise ValueError("open_positions cannot be negative")


@dataclass(frozen=True, slots=True)
class Proposal:
    """A hypothetical paper allocation. Not an order."""

    market_id: str
    notional_usdc: Decimal
    liquidity_usdc: Decimal | None
    edge: Decimal | None = None

    def __post_init__(self) -> None:
        if not self.market_id.strip():
            raise ValueError("market_id is required")
        if self.notional_usdc <= 0:
            raise ValueError("notional_usdc must be positive")


@dataclass(frozen=True, slots=True)
class Decision:
    allowed: bool
    reasons: tuple[str, ...]
    max_notional_usdc: Decimal
    edge_checked: bool


def evaluate(
    proposal: Proposal,
    state: RiskState,
    limits: RiskLimits,
    *,
    require_edge: bool = False,
) -> Decision:
    """Return whether a paper proposal passes the hard rules.

    ``require_edge`` stays false until a fair-value model exists. Missing an
    estimate is then a refusal, not a silent pass.
    """

    reasons: list[str] = []
    if proposal.notional_usdc > limits.max_notional_usdc:
        reasons.append("notional_over_market_cap")
    if state.open_positions >= limits.max_open_positions:
        reasons.append("open_position_cap")
    daily_loss = -min(state.daily_pnl_usdc, Decimal("0"))
    if daily_loss >= limits.daily_loss_usdc:
        reasons.append("daily_loss_breaker")
    if proposal.liquidity_usdc is None or proposal.liquidity_usdc < limits.min_liquidity_usdc:
        reasons.append("liquidity_below_minimum")
    edge_checked = require_edge or proposal.edge is not None
    if require_edge and proposal.edge is None:
        reasons.append("edge_missing")
    elif proposal.edge is not None and abs(proposal.edge) < limits.min_edge:
        reasons.append("edge_below_minimum")
    return Decision(
        allowed=not reasons,
        reasons=tuple(reasons),
        max_notional_usdc=limits.max_notional_usdc,
        edge_checked=edge_checked,
    )
