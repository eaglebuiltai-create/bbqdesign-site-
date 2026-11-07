"""Research-mode gate.

Paper and shadow are the only modes this package will run. Live trading is
refused here, before any client is constructed.
"""

from __future__ import annotations

RESEARCH_MODES = frozenset({"paper", "shadow"})


class ResearchModeError(RuntimeError):
    """Raised when a caller asks for a mode this package will not run."""


def assert_research_mode(mode: str) -> str:
    """Return a normalized research mode, or refuse anything else."""

    normalized = mode.strip().lower()
    if normalized not in RESEARCH_MODES:
        raise ResearchModeError(
            "This package runs in paper or shadow mode only. "
            "Live orders and transaction signing are not implemented. "
            "Approve that exact action before any live-trading code is added."
        )
    return normalized
