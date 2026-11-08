"""Select the YES asset id the CLOB uses for a binary market.

CTF (v1) markets trade ERC-1155 token ids. Polymarket Protocol v2 markets
trade position ids. When both pairs are present, the token pair is the v1
discriminant, matching the official py-sdk example helper.
"""

from __future__ import annotations

from typing import Any


def _text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def yes_asset_id(market: Any) -> str | None:
    """Return the YES CLOB asset id, or None when the market has no pair."""

    outcomes = getattr(market, "outcomes", None)
    if outcomes is None:
        return None
    yes = getattr(outcomes, "yes", None)
    no = getattr(outcomes, "no", None)
    if yes is None or no is None:
        return None
    yes_token = _text(getattr(yes, "token_id", None))
    no_token = _text(getattr(no, "token_id", None))
    if yes_token is not None and no_token is not None:
        return yes_token
    yes_position = _text(getattr(yes, "position_id", None))
    no_position = _text(getattr(no, "position_id", None))
    if yes_position is not None and no_position is not None:
        return yes_position
    return None


def protocol_version(market: Any) -> str | None:
    version = getattr(market, "version", None)
    if version is None:
        return None
    value = getattr(version, "value", version)
    text = str(value).strip().lower()
    return text or None
