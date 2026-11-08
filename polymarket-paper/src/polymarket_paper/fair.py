"""Baseline P(YES) from the quoted price.

This is a favorite-longshot calibration, not a news forecast. It does not
read anything except the price it is given. Low quotes are pulled down and
high quotes are pulled up:

    fair = p^a / (p^a + (1-p)^a)

with a = 1.2. At 0.50 the fair value is 0.50. Near 0.20 and 0.80 the gap
is about 4 cents. Near 0.40 it stays under 3 cents, so those rows do not flag.
"""

from __future__ import annotations

from decimal import Decimal

LONGSHOT_EXPONENT = Decimal("1.2")
_ONE = Decimal("1")
_QUANTUM = Decimal("0.000001")


def calibrate_yes(price: Decimal, *, exponent: Decimal = LONGSHOT_EXPONENT) -> Decimal:
    """Return a calibrated P(YES) in (0, 1)."""

    if price <= 0 or price >= 1:
        raise ValueError("price must be above 0 and below 1")
    if exponent <= 0:
        raise ValueError("exponent must be positive")
    weighted = price ** exponent
    fair = weighted / (weighted + (_ONE - price) ** exponent)
    return fair.quantize(_QUANTUM)
