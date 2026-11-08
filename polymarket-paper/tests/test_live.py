from decimal import Decimal
from types import SimpleNamespace

import pytest

from polymarket_paper.__main__ import main
from polymarket_paper.live import LiveLimitOrder, LiveOrderError, submit_live_limit_order

SECRET = "test-signing-key"


def _order(**overrides: object) -> LiveLimitOrder:
    raw: dict[str, object] = {
        "market_id": "m1",
        "asset_id": "asset-yes",
        "side": "BUY",
        "price": Decimal("0.40"),
        "size": Decimal("10"),
        "liquidity_usdc": Decimal("5000"),
    }
    raw.update(overrides)
    return LiveLimitOrder(**raw)  # type: ignore[arg-type]


class FakeSender:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []
        self.closed = False
        self.response = SimpleNamespace(
            ok=True,
            order_id="ord-1",
            status="live",
            trade_ids=(),
            code=None,
            message=None,
        )

    def place_limit_order(self, **kwargs: object) -> SimpleNamespace:
        self.calls.append(kwargs)
        return self.response

    def close(self) -> None:
        self.closed = True


def _submit(order: LiveLimitOrder, factory, **overrides: object) -> object:
    raw: dict[str, object] = {
        "confirm": order.confirmation(),
        "mode": "live",
        "live_switch": "yes",
        "signing_key": SECRET,
        "client_factory": factory,
    }
    raw.update(overrides)
    return submit_live_limit_order(order, **raw)  # type: ignore[arg-type]


def test_gates_block_before_a_client_exists() -> None:
    order = _order()
    sender = FakeSender()

    def factory(_key: str) -> FakeSender:
        raise AssertionError("client should not be opened")

    with pytest.raises(LiveOrderError, match="POLYMARKET_MODE"):
        _submit(order, factory, mode="paper")
    with pytest.raises(LiveOrderError, match="Confirmation"):
        _submit(order, factory, confirm="submit something else")
    with pytest.raises(LiveOrderError, match="POLYMARKET_LIVE_ORDER"):
        _submit(order, factory, live_switch="no")
    huge = _order(size=Decimal("1000"))
    with pytest.raises(LiveOrderError, match="notional_over_market_cap"):
        _submit(huge, factory)
    crowded = _order(open_positions=8)
    with pytest.raises(LiveOrderError, match="open_position_cap"):
        _submit(crowded, factory)
    assert sender.calls == []


def test_missing_key_does_not_open_a_client() -> None:
    order = _order()

    def factory(_key: str) -> FakeSender:
        raise AssertionError("client should not be opened")

    with pytest.raises(LiveOrderError, match="POLYMARKET_PRIVATE_KEY"):
        _submit(order, factory, signing_key=None)
    with pytest.raises(LiveOrderError, match="POLYMARKET_PRIVATE_KEY"):
        _submit(order, factory, signing_key="  ")


def test_confirmed_order_is_posted_once_and_the_client_closes() -> None:
    order = _order()
    sender = FakeSender()
    seen: list[str] = []

    def factory(key: str) -> FakeSender:
        seen.append(key)
        return sender

    result = _submit(order, factory)
    assert result.ok is True
    assert result.order_id == "ord-1"
    assert seen == [SECRET]
    assert sender.closed is True
    assert sender.calls == [
        {
            "asset_id": "asset-yes",
            "side": "BUY",
            "price": "0.40",
            "size": "10",
            "post_only": True,
        }
    ]
    assert SECRET not in str(result.to_json())


def test_cli_refuses_without_opening_the_official_client(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    def explode(_key: str) -> None:
        raise AssertionError("official client should not be opened")

    monkeypatch.setattr("polymarket_paper.__main__.default_secure_client", explode)
    monkeypatch.setenv("POLYMARKET_MODE", "live")
    monkeypatch.setenv("POLYMARKET_LIVE_ORDER", "yes")
    monkeypatch.setenv("POLYMARKET_PRIVATE_KEY", SECRET)
    code = main(
        [
            "live-order",
            "--market-id",
            "m1",
            "--asset-id",
            "asset-yes",
            "--side",
            "BUY",
            "--price",
            "0.40",
            "--size",
            "10",
            "--liquidity",
            "5000",
            "--confirm",
            "not the phrase",
        ]
    )
    captured = capsys.readouterr()
    assert code == 2
    assert "post_only=true" in captured.err
    assert SECRET not in captured.err
    assert SECRET not in captured.out


def test_cli_submits_through_the_injected_client(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    sender = FakeSender()

    def factory(key: str) -> FakeSender:
        assert key == SECRET
        return sender

    monkeypatch.setattr("polymarket_paper.__main__.default_secure_client", factory)
    monkeypatch.setenv("POLYMARKET_MODE", "live")
    monkeypatch.setenv("POLYMARKET_LIVE_ORDER", "yes")
    monkeypatch.setenv("POLYMARKET_PRIVATE_KEY", SECRET)
    order = _order()
    code = main(
        [
            "live-order",
            "--market-id",
            "m1",
            "--asset-id",
            "asset-yes",
            "--side",
            "BUY",
            "--price",
            "0.40",
            "--size",
            "10",
            "--liquidity",
            "5000",
            "--confirm",
            order.confirmation(),
        ]
    )
    captured = capsys.readouterr()
    assert code == 0
    assert "ord-1" in captured.out
    assert SECRET not in captured.out
    assert sender.closed is True
