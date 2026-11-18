"""One confirmed limit order.

The official call is ``SecureClient.place_limit_order``. Docs:
https://docs.polymarket.com/trading/orders/create

Nothing here runs unless three locks match this order: ``POLYMARKET_MODE=live``,
``POLYMARKET_LIVE_ORDER=yes``, and ``--confirm`` equal to the order phrase.
The private key is read from the environment and is never put in a result.
This module does not choose a market or submit an order by itself.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Protocol

from polymarket_paper.models import decimal_string
from polymarket_paper.risk import Decision, Proposal, RiskLimits, RiskState, evaluate

_ZERO = Decimal("0")
_ONE = Decimal("1")


class LiveOrderError(RuntimeError):
    """The order was not sent."""


class LimitOrderSender(Protocol):
    def place_limit_order(
        self,
        *,
        asset_id: str,
        side: str,
        price: str,
        size: str,
        post_only: bool = False,
    ) -> Any: ...

    def close(self) -> None: ...


@dataclass(frozen=True, slots=True)
class LiveLimitOrder:
    """The exact order a confirmation phrase has to name."""

    market_id: str
    asset_id: str
    side: str
    price: Decimal
    size: Decimal
    liquidity_usdc: Decimal
    post_only: bool = True
    edge: Decimal | None = None
    require_edge: bool = False
    open_positions: int = 0
    daily_pnl_usdc: Decimal = Decimal("0")
    limits: RiskLimits | None = None

    def __post_init__(self) -> None:
        if not self.market_id.strip():
            raise LiveOrderError("market_id is required")
        if not self.asset_id.strip():
            raise LiveOrderError("asset_id is required")
        if self.side not in {"BUY", "SELL"}:
            raise LiveOrderError("side must be BUY or SELL")
        if self.price <= _ZERO or self.price >= _ONE:
            raise LiveOrderError("price must be above 0 and below 1")
        if self.size <= _ZERO:
            raise LiveOrderError("size must be positive")
        if self.open_positions < 0:
            raise LiveOrderError("open_positions cannot be negative")

    @property
    def notional_usdc(self) -> Decimal:
        return self.price * self.size

    def confirmation(self) -> str:
        resting = "true" if self.post_only else "false"
        return (
            f"submit {self.side} {format(self.size, 'f')} shares of {self.asset_id} "
            f"at {format(self.price, 'f')} for market {self.market_id} post_only={resting}"
        )


@dataclass(frozen=True, slots=True)
class LiveSubmitResult:
    ok: bool
    order_id: str | None
    status: str | None
    code: str | None
    message: str | None
    trade_ids: tuple[str, ...]
    market_id: str
    asset_id: str
    side: str
    price: Decimal
    size: Decimal
    post_only: bool

    def to_json(self) -> dict[str, Any]:
        return {
            "type": "live_order",
            "ok": self.ok,
            "order_id": self.order_id,
            "status": self.status,
            "code": self.code,
            "message": self.message,
            "trade_ids": list(self.trade_ids),
            "market_id": self.market_id,
            "asset_id": self.asset_id,
            "side": self.side,
            "price": decimal_string(self.price),
            "size": decimal_string(self.size),
            "post_only": self.post_only,
        }


def _risk_decision(order: LiveLimitOrder) -> Decision:
    limits = order.limits or RiskLimits()
    opening_new = order.side == "BUY"
    return evaluate(
        Proposal(
            market_id=order.market_id,
            notional_usdc=order.notional_usdc,
            liquidity_usdc=order.liquidity_usdc,
            edge=order.edge,
        ),
        RiskState(open_positions=order.open_positions, daily_pnl_usdc=order.daily_pnl_usdc),
        limits,
        require_edge=order.require_edge,
        opening_new=opening_new,
    )


def gate_live_order(
    order: LiveLimitOrder,
    *,
    confirm: str,
    mode: str | None,
    live_switch: str | None,
) -> Decision:
    """Refuse unless this exact order is confirmed and the risk checks pass.

    Does not read a key and does not construct a client.
    """

    if (mode or "").strip().lower() != "live":
        raise LiveOrderError("Set POLYMARKET_MODE=live to submit an order.")
    if confirm.strip() != order.confirmation():
        raise LiveOrderError(
            "Confirmation does not match this order. "
            f"Pass --confirm exactly:\n{order.confirmation()}"
        )
    if (live_switch or "").strip().lower() != "yes":
        raise LiveOrderError("Set POLYMARKET_LIVE_ORDER=yes to submit this order.")
    decision = _risk_decision(order)
    if not decision.allowed:
        raise LiveOrderError("risk refused: " + ",".join(decision.reasons))
    return decision


def default_secure_client(private_key: str) -> Any:
    """Open the official authenticated client. Called only after the gates pass."""

    from polymarket import SecureClient

    return SecureClient.create(private_key=private_key)


def submit_live_limit_order(
    order: LiveLimitOrder,
    *,
    confirm: str,
    mode: str | None,
    live_switch: str | None,
    signing_key: str | None,
    client_factory: Any = default_secure_client,
) -> LiveSubmitResult:
    """Sign and post one limit order after the gates pass."""

    gate_live_order(order, confirm=confirm, mode=mode, live_switch=live_switch)
    key = (signing_key or "").strip()
    if not key:
        raise LiveOrderError("POLYMARKET_PRIVATE_KEY is not set.")
    client = client_factory(key)
    try:
        response = client.place_limit_order(
            asset_id=order.asset_id,
            side=order.side,
            price=format(order.price, "f"),
            size=format(order.size, "f"),
            post_only=order.post_only,
        )
    finally:
        close = getattr(client, "close", None)
        if callable(close):
            close()
    ok = bool(getattr(response, "ok", False))
    trade_ids = tuple(str(item) for item in getattr(response, "trade_ids", ()) or ())
    return LiveSubmitResult(
        ok=ok,
        order_id=None if getattr(response, "order_id", None) is None else str(response.order_id),
        status=None if getattr(response, "status", None) is None else str(response.status),
        code=None if getattr(response, "code", None) is None else str(response.code),
        message=None if getattr(response, "message", None) is None else str(response.message),
        trade_ids=trade_ids,
        market_id=order.market_id,
        asset_id=order.asset_id,
        side=order.side,
        price=order.price,
        size=order.size,
        post_only=order.post_only,
    )


def redact(text: str, secret: str | None) -> str:
    value = (secret or "").strip()
    if value and value in text:
        return text.replace(value, "[redacted]")
    return text


def signing_key_from_environ() -> str | None:
    return os.environ.get("POLYMARKET_PRIVATE_KEY")
