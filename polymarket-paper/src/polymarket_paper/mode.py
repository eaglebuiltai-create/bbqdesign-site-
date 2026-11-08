"""Mode gate for scans and the paper book.

Paper and shadow are the only modes for those commands. A live limit order
uses the separate live-order command and its own confirmation checks.
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
            "Scans and the paper book run in paper or shadow mode only. "
            "A live limit order uses the live-order command."
        )
    return normalized
