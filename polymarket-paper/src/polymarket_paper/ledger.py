"""Local paper book.

A buy is recorded only after ``risk.evaluate`` passes and the book still has
the cash. Shadow runs the same checks and writes nothing. Nothing in this
module sends an order or signs a transaction.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from polymarket_paper.models import decimal_string
from polymarket_paper.risk import Decision, Proposal, RiskLimits, RiskState, evaluate

PACIFIC = ZoneInfo("America/Los_Angeles")
BOOK_VERSION = 1
_ONE = Decimal("1")
_ZERO = Decimal("0")


class LedgerError(ValueError):
    """The paper book could not be read or the command does not fit it."""


@dataclass(frozen=True, slots=True)
class PaperPosition:
    market_id: str
    outcome: str
    question: str | None
    shares: Decimal
    cost_usdc: Decimal
    entry_price: Decimal
    mark_price: Decimal | None
    opened_at: datetime

    def unrealized_usdc(self) -> Decimal:
        mark = self.entry_price if self.mark_price is None else self.mark_price
        return self.shares * mark - self.cost_usdc

    def to_json(self) -> dict[str, Any]:
        return {
            "market_id": self.market_id,
            "outcome": self.outcome,
            "question": self.question,
            "shares": decimal_string(self.shares),
            "cost_usdc": decimal_string(self.cost_usdc),
            "entry_price": decimal_string(self.entry_price),
            "mark_price": decimal_string(self.mark_price),
            "opened_at": self.opened_at.isoformat(),
        }


@dataclass(frozen=True, slots=True)
class PaperFill:
    fill_id: int
    recorded_at: datetime
    action: str
    market_id: str
    outcome: str
    price: Decimal
    shares: Decimal
    notional_usdc: Decimal
    realized_usdc: Decimal

    def to_json(self) -> dict[str, Any]:
        return {
            "fill_id": self.fill_id,
            "recorded_at": self.recorded_at.isoformat(),
            "action": self.action,
            "market_id": self.market_id,
            "outcome": self.outcome,
            "price": decimal_string(self.price),
            "shares": decimal_string(self.shares),
            "notional_usdc": decimal_string(self.notional_usdc),
            "realized_usdc": decimal_string(self.realized_usdc),
        }


@dataclass(frozen=True, slots=True)
class LedgerDecision:
    """Result of a paper or shadow command. ``recorded`` means the book changed."""

    action: str
    mode: str
    allowed: bool
    recorded: bool
    reasons: tuple[str, ...]
    decision: Decision | None
    market_id: str
    outcome: str
    cash_usdc: Decimal
    open_positions: int
    daily_pnl_usdc: Decimal
    fill: PaperFill | None = None

    @property
    def label(self) -> str:
        if self.recorded:
            return "recorded"
        if self.allowed:
            return "allowed_not_recorded"
        return "refused"

    def to_json(self) -> dict[str, Any]:
        return {
            "type": "paper_decision",
            "action": self.action,
            "mode": self.mode,
            "label": self.label,
            "allowed": self.allowed,
            "recorded": self.recorded,
            "reasons": list(self.reasons),
            "risk_reasons": [] if self.decision is None else list(self.decision.reasons),
            "market_id": self.market_id,
            "outcome": self.outcome,
            "cash_usdc": decimal_string(self.cash_usdc),
            "open_positions": self.open_positions,
            "daily_pnl_usdc": decimal_string(self.daily_pnl_usdc),
            "fill": None if self.fill is None else self.fill.to_json(),
        }


def _now(now: datetime | None) -> datetime:
    if now is None:
        return datetime.now(PACIFIC)
    if now.tzinfo is None:
        raise LedgerError("timestamps must include a timezone")
    return now.astimezone(PACIFIC)


def _decimal(value: object, field: str) -> Decimal:
    if value is None:
        raise LedgerError(f"{field} is missing")
    try:
        return Decimal(str(value))
    except Exception as exc:
        raise LedgerError(f"{field} is not a decimal") from exc


def _optional_decimal(value: object) -> Decimal | None:
    if value is None:
        return None
    return Decimal(str(value))


def _parse_time(value: object, field: str) -> datetime:
    if not isinstance(value, str):
        raise LedgerError(f"{field} is missing")
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError as exc:
        raise LedgerError(f"{field} is not a timestamp") from exc
    if parsed.tzinfo is None:
        raise LedgerError(f"{field} must include a timezone")
    return parsed


def _limits_from_json(raw: object) -> RiskLimits:
    if not isinstance(raw, dict):
        raise LedgerError("risk limits are missing")
    try:
        return RiskLimits(
            bankroll_usdc=_decimal(raw.get("bankroll_usdc"), "bankroll_usdc"),
            max_fraction_per_market=_decimal(raw.get("max_fraction_per_market"), "max_fraction_per_market"),
            max_open_positions=int(raw["max_open_positions"]),
            daily_loss_fraction=_decimal(raw.get("daily_loss_fraction"), "daily_loss_fraction"),
            min_liquidity_usdc=_decimal(raw.get("min_liquidity_usdc"), "min_liquidity_usdc"),
            min_edge=_decimal(raw.get("min_edge"), "min_edge"),
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise LedgerError(f"stored risk limits are not usable: {exc}") from exc


def _limits_to_json(limits: RiskLimits) -> dict[str, Any]:
    return {
        "bankroll_usdc": decimal_string(limits.bankroll_usdc),
        "max_fraction_per_market": decimal_string(limits.max_fraction_per_market),
        "max_open_positions": limits.max_open_positions,
        "daily_loss_fraction": decimal_string(limits.daily_loss_fraction),
        "min_liquidity_usdc": decimal_string(limits.min_liquidity_usdc),
        "min_edge": decimal_string(limits.min_edge),
    }


def _check_outcome(outcome: str) -> str:
    normalized = outcome.strip().lower()
    if normalized not in {"yes", "no"}:
        raise LedgerError("outcome must be yes or no")
    return normalized


def _check_trade_price(price: Decimal) -> str | None:
    if price <= _ZERO or price >= _ONE:
        return "price_out_of_range"
    return None


def _check_settlement_price(price: Decimal) -> str | None:
    if price < _ZERO or price > _ONE:
        return "price_out_of_range"
    return None


class PaperBook:
    """Cash, holdings, and the fills that passed the risk gate."""

    def __init__(
        self,
        *,
        limits: RiskLimits,
        cash_usdc: Decimal,
        day: date,
        realized_today_usdc: Decimal,
        unrealized_at_day_start_usdc: Decimal,
        next_id: int,
        positions: tuple[PaperPosition, ...] = (),
        fills: tuple[PaperFill, ...] = (),
    ) -> None:
        self.limits = limits
        self.cash_usdc = cash_usdc
        self.day = day
        self.realized_today_usdc = realized_today_usdc
        self.unrealized_at_day_start_usdc = unrealized_at_day_start_usdc
        self.next_id = next_id
        self.positions = list(positions)
        self.fills = list(fills)

    @classmethod
    def new(cls, limits: RiskLimits | None = None, *, now: datetime | None = None) -> PaperBook:
        clock = _now(now)
        chosen = limits or RiskLimits()
        return cls(
            limits=chosen,
            cash_usdc=chosen.bankroll_usdc,
            day=clock.date(),
            realized_today_usdc=_ZERO,
            unrealized_at_day_start_usdc=_ZERO,
            next_id=1,
        )

    def unrealized_usdc(self) -> Decimal:
        return sum((position.unrealized_usdc() for position in self.positions), _ZERO)

    def daily_pnl_usdc(self) -> Decimal:
        return self.realized_today_usdc + (self.unrealized_usdc() - self.unrealized_at_day_start_usdc)

    def open_position_count(self) -> int:
        return sum(1 for position in self.positions if position.shares > 0)

    def market_cost_usdc(self, market_id: str) -> Decimal:
        return sum(
            (position.cost_usdc for position in self.positions if position.market_id == market_id),
            _ZERO,
        )

    def breaker_tripped(self) -> bool:
        loss = -min(self.daily_pnl_usdc(), _ZERO)
        return loss >= self.limits.daily_loss_usdc

    def find(self, market_id: str, outcome: str) -> PaperPosition | None:
        for position in self.positions:
            if position.market_id == market_id and position.outcome == outcome:
                return position
        return None

    def roll_day(self, now: datetime) -> None:
        today = now.date()
        if today == self.day:
            return
        self.unrealized_at_day_start_usdc = self.unrealized_usdc()
        self.realized_today_usdc = _ZERO
        self.day = today

    def propose_buy(
        self,
        *,
        mode: str,
        market_id: str,
        outcome: str,
        notional_usdc: Decimal,
        price: Decimal,
        liquidity_usdc: Decimal | None,
        edge: Decimal | None = None,
        question: str | None = None,
        require_edge: bool = False,
        now: datetime | None = None,
    ) -> LedgerDecision:
        """Record a hypothetical buy, or refuse it.

        Paper mode writes the holding only when every reason list is empty.
        Shadow mode returns the same decision and leaves the book unchanged.
        """

        if mode not in {"paper", "shadow"}:
            raise LedgerError("mode must be paper or shadow")
        clock = _now(now)
        outcome = _check_outcome(outcome)
        market_id = market_id.strip()
        if not market_id:
            raise LedgerError("market_id is required")
        if notional_usdc <= 0:
            raise LedgerError("notional_usdc must be positive")
        if mode == "paper":
            self.roll_day(clock)

        reasons: list[str] = []
        price_reason = _check_trade_price(price)
        if price_reason:
            reasons.append(price_reason)
        existing = self.find(market_id, outcome)
        opening_new = existing is None
        proposal = Proposal(
            market_id=market_id,
            notional_usdc=self.market_cost_usdc(market_id) + notional_usdc,
            liquidity_usdc=liquidity_usdc,
            edge=edge,
        )
        decision = evaluate(
            proposal,
            RiskState(
                open_positions=self.open_position_count(),
                daily_pnl_usdc=self.daily_pnl_usdc(),
            ),
            self.limits,
            require_edge=require_edge,
            opening_new=opening_new,
        )
        reasons.extend(decision.reasons)
        if notional_usdc > self.cash_usdc:
            reasons.append("cash_short")
        unique = tuple(dict.fromkeys(reasons))
        if mode == "shadow" or unique:
            return self._decision(
                action="buy",
                mode=mode,
                allowed=not unique,
                recorded=False,
                reasons=unique,
                decision=decision,
                market_id=market_id,
                outcome=outcome,
            )

        shares = notional_usdc / price
        if existing is None:
            position = PaperPosition(
                market_id=market_id,
                outcome=outcome,
                question=question or None,
                shares=shares,
                cost_usdc=notional_usdc,
                entry_price=price,
                mark_price=None,
                opened_at=clock,
            )
            self.positions.append(position)
        else:
            cost = existing.cost_usdc + notional_usdc
            total_shares = existing.shares + shares
            updated = PaperPosition(
                market_id=existing.market_id,
                outcome=existing.outcome,
                question=existing.question or question or None,
                shares=total_shares,
                cost_usdc=cost,
                entry_price=cost / total_shares,
                mark_price=existing.mark_price,
                opened_at=existing.opened_at,
            )
            self._replace(updated)
        self.cash_usdc -= notional_usdc
        fill = self._append_fill(
            action="buy",
            recorded_at=clock,
            market_id=market_id,
            outcome=outcome,
            price=price,
            shares=shares,
            notional_usdc=notional_usdc,
            realized_usdc=_ZERO,
        )
        return self._decision(
            action="buy",
            mode=mode,
            allowed=True,
            recorded=True,
            reasons=(),
            decision=decision,
            market_id=market_id,
            outcome=outcome,
            fill=fill,
        )

    def close_position(
        self,
        *,
        mode: str,
        market_id: str,
        outcome: str,
        price: Decimal,
        shares: Decimal | None = None,
        now: datetime | None = None,
    ) -> LedgerDecision:
        """Sell shares of an open holding.

        A close reduces exposure, so the open-risk gate does not block it.
        That keeps a tripped daily-loss breaker from trapping the book.
        """

        if mode not in {"paper", "shadow"}:
            raise LedgerError("mode must be paper or shadow")
        clock = _now(now)
        outcome = _check_outcome(outcome)
        market_id = market_id.strip()
        if mode == "paper":
            self.roll_day(clock)
        reasons: list[str] = []
        price_reason = _check_settlement_price(price)
        if price_reason:
            reasons.append(price_reason)
        position = self.find(market_id, outcome)
        if position is None:
            reasons.append("position_missing")
        elif shares is None:
            shares = position.shares
        elif shares <= 0 or shares > position.shares:
            reasons.append("shares_out_of_range")
        unique = tuple(dict.fromkeys(reasons))
        if mode == "shadow" or unique or position is None or shares is None:
            return self._decision(
                action="sell",
                mode=mode,
                allowed=not unique,
                recorded=False,
                reasons=unique,
                decision=None,
                market_id=market_id,
                outcome=outcome,
            )

        released_cost = position.cost_usdc * shares / position.shares
        proceeds = shares * price
        realized = proceeds - released_cost
        remaining = position.shares - shares
        if mode == "paper":
            self.cash_usdc += proceeds
            self.realized_today_usdc += realized
            if remaining == 0:
                self.positions = [
                    item
                    for item in self.positions
                    if not (item.market_id == market_id and item.outcome == outcome)
                ]
            else:
                self._replace(
                    PaperPosition(
                        market_id=position.market_id,
                        outcome=position.outcome,
                        question=position.question,
                        shares=remaining,
                        cost_usdc=position.cost_usdc - released_cost,
                        entry_price=position.entry_price,
                        mark_price=position.mark_price,
                        opened_at=position.opened_at,
                    )
                )
        fill = None
        if mode == "paper":
            fill = self._append_fill(
                action="sell",
                recorded_at=clock,
                market_id=market_id,
                outcome=outcome,
                price=price,
                shares=shares,
                notional_usdc=proceeds,
                realized_usdc=realized,
            )
        return self._decision(
            action="sell",
            mode=mode,
            allowed=True,
            recorded=mode == "paper",
            reasons=(),
            decision=None,
            market_id=market_id,
            outcome=outcome,
            fill=fill,
        )

    def mark(
        self,
        *,
        mode: str,
        market_id: str,
        outcome: str,
        price: Decimal,
        now: datetime | None = None,
    ) -> LedgerDecision:
        """Set the mark used for unrealized PnL and the daily-loss breaker."""

        if mode not in {"paper", "shadow"}:
            raise LedgerError("mode must be paper or shadow")
        clock = _now(now)
        outcome = _check_outcome(outcome)
        market_id = market_id.strip()
        if mode == "paper":
            self.roll_day(clock)
        reasons: list[str] = []
        price_reason = _check_settlement_price(price)
        if price_reason:
            reasons.append(price_reason)
        position = self.find(market_id, outcome)
        if position is None:
            reasons.append("position_missing")
        unique = tuple(dict.fromkeys(reasons))
        if mode == "shadow" or unique or position is None:
            return self._decision(
                action="mark",
                mode=mode,
                allowed=not unique,
                recorded=False,
                reasons=unique,
                decision=None,
                market_id=market_id,
                outcome=outcome,
            )
        self._replace(
            PaperPosition(
                market_id=position.market_id,
                outcome=position.outcome,
                question=position.question,
                shares=position.shares,
                cost_usdc=position.cost_usdc,
                entry_price=position.entry_price,
                mark_price=price,
                opened_at=position.opened_at,
            )
        )
        return self._decision(
            action="mark",
            mode=mode,
            allowed=True,
            recorded=True,
            reasons=(),
            decision=None,
            market_id=market_id,
            outcome=outcome,
        )

    def _replace(self, updated: PaperPosition) -> None:
        self.positions = [
            updated if item.market_id == updated.market_id and item.outcome == updated.outcome else item
            for item in self.positions
        ]

    def _append_fill(self, **kwargs: Any) -> PaperFill:
        fill = PaperFill(fill_id=self.next_id, **kwargs)
        self.next_id += 1
        self.fills.append(fill)
        return fill

    def _decision(
        self,
        *,
        action: str,
        mode: str,
        allowed: bool,
        recorded: bool,
        reasons: tuple[str, ...],
        decision: Decision | None,
        market_id: str,
        outcome: str,
        fill: PaperFill | None = None,
    ) -> LedgerDecision:
        return LedgerDecision(
            action=action,
            mode=mode,
            allowed=allowed,
            recorded=recorded,
            reasons=reasons,
            decision=decision,
            market_id=market_id,
            outcome=outcome,
            cash_usdc=self.cash_usdc,
            open_positions=self.open_position_count(),
            daily_pnl_usdc=self.daily_pnl_usdc(),
            fill=fill,
        )

    def to_json(self) -> dict[str, Any]:
        return {
            "version": BOOK_VERSION,
            "limits": _limits_to_json(self.limits),
            "cash_usdc": decimal_string(self.cash_usdc),
            "day": self.day.isoformat(),
            "realized_today_usdc": decimal_string(self.realized_today_usdc),
            "unrealized_at_day_start_usdc": decimal_string(self.unrealized_at_day_start_usdc),
            "next_id": self.next_id,
            "positions": [position.to_json() for position in self.positions],
            "fills": [fill.to_json() for fill in self.fills],
        }

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps(self.to_json(), indent=2, sort_keys=True) + "\n"
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text(payload, encoding="utf-8")
        os.replace(temporary, path)


def load_book(path: Path) -> PaperBook:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise LedgerError(f"no paper book at {path}") from exc
    except json.JSONDecodeError as exc:
        raise LedgerError(f"paper book at {path} is not valid JSON") from exc
    if not isinstance(raw, dict) or raw.get("version") != BOOK_VERSION:
        raise LedgerError("paper book version is not supported")
    try:
        day = date.fromisoformat(str(raw["day"]))
    except (KeyError, ValueError) as exc:
        raise LedgerError("paper book day is missing") from exc
    positions = tuple(_position_from_json(item) for item in raw.get("positions", []))
    fills = tuple(_fill_from_json(item) for item in raw.get("fills", []))
    return PaperBook(
        limits=_limits_from_json(raw.get("limits")),
        cash_usdc=_decimal(raw.get("cash_usdc"), "cash_usdc"),
        day=day,
        realized_today_usdc=_decimal(raw.get("realized_today_usdc"), "realized_today_usdc"),
        unrealized_at_day_start_usdc=_decimal(
            raw.get("unrealized_at_day_start_usdc"),
            "unrealized_at_day_start_usdc",
        ),
        next_id=int(raw.get("next_id", 1)),
        positions=positions,
        fills=fills,
    )


def _position_from_json(raw: object) -> PaperPosition:
    if not isinstance(raw, dict):
        raise LedgerError("a stored position is not an object")
    return PaperPosition(
        market_id=str(raw.get("market_id", "")).strip(),
        outcome=_check_outcome(str(raw.get("outcome", ""))),
        question=raw.get("question"),
        shares=_decimal(raw.get("shares"), "shares"),
        cost_usdc=_decimal(raw.get("cost_usdc"), "cost_usdc"),
        entry_price=_decimal(raw.get("entry_price"), "entry_price"),
        mark_price=_optional_decimal(raw.get("mark_price")),
        opened_at=_parse_time(raw.get("opened_at"), "opened_at"),
    )


def _fill_from_json(raw: object) -> PaperFill:
    if not isinstance(raw, dict):
        raise LedgerError("a stored fill is not an object")
    return PaperFill(
        fill_id=int(raw["fill_id"]),
        recorded_at=_parse_time(raw.get("recorded_at"), "recorded_at"),
        action=str(raw.get("action", "")),
        market_id=str(raw.get("market_id", "")),
        outcome=_check_outcome(str(raw.get("outcome", ""))),
        price=_decimal(raw.get("price"), "price"),
        shares=_decimal(raw.get("shares"), "shares"),
        notional_usdc=_decimal(raw.get("notional_usdc"), "notional_usdc"),
        realized_usdc=_decimal(raw.get("realized_usdc"), "realized_usdc"),
    )


def render_book(book: PaperBook, *, path: Path | None = None) -> str:
    breaker = "tripped" if book.breaker_tripped() else "open"
    lines = [
        f"book={path or '(memory)'}  day={book.day.isoformat()}  breaker={breaker}",
        (
            f"cash={book.cash_usdc:.2f}  bankroll={book.limits.bankroll_usdc:.2f}  "
            f"daily_pnl={book.daily_pnl_usdc():.2f}  "
            f"open={book.open_position_count()}/{book.limits.max_open_positions}  "
            f"max_per_market={book.limits.max_notional_usdc:.2f}"
        ),
        "",
        f"{'market':<16}  {'out':<3}  {'shares':>12}  {'entry':>8}  {'mark':>8}  {'cost':>10}  {'unreal':>10}",
    ]
    if not book.positions:
        lines.append("(no open holdings)")
    for position in book.positions:
        mark = "-" if position.mark_price is None else f"{position.mark_price:.4f}"
        question = position.question or position.market_id
        lines.append(
            f"{question[:16]:<16}  {position.outcome:<3}  {position.shares:>12.4f}  "
            f"{position.entry_price:>8.4f}  {mark:>8}  {position.cost_usdc:>10.2f}  "
            f"{position.unrealized_usdc():>10.2f}"
        )
    if book.fills:
        lines.append("")
        lines.append("recent fills")
        for fill in book.fills[-5:]:
            stamp = fill.recorded_at.astimezone(PACIFIC).strftime("%Y-%m-%d %H:%M %Z")
            lines.append(
                f"{fill.fill_id:>3}  {stamp}  {fill.action:<4}  {fill.outcome:<3}  "
                f"{fill.shares:.4f} @ {fill.price:.4f}  realized={fill.realized_usdc:.2f}"
            )
    return "\n".join(lines)


def render_decision(result: LedgerDecision) -> str:
    reasons = ",".join(result.reasons) if result.reasons else "-"
    lines = [
        (
            f"mode={result.mode}  action={result.action}  decision={result.label}  "
            f"reasons={reasons}"
        ),
        (
            f"market={result.market_id}  outcome={result.outcome}  "
            f"cash={result.cash_usdc:.2f}  open={result.open_positions}  "
            f"daily_pnl={result.daily_pnl_usdc:.2f}"
        ),
    ]
    if result.fill is not None:
        fill = result.fill
        lines.append(
            f"fill={fill.fill_id}  {fill.shares:.4f} shares @ {fill.price:.4f}  "
            f"notional={fill.notional_usdc:.2f}  realized={fill.realized_usdc:.2f}"
        )
    return "\n".join(lines)
