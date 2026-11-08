"""Paper-only Polymarket research toolkit.

Public market reads only. This package does not construct a trading client,
sign messages, or submit orders.
"""

from polymarket_paper.ledger import LedgerDecision, PaperBook
from polymarket_paper.models import BookTop, MarketSnapshot, ScanResult
from polymarket_paper.risk import Decision, Proposal, RiskLimits, RiskState, evaluate
from polymarket_paper.scanner import scan_markets

__all__ = [
    "BookTop",
    "Decision",
    "LedgerDecision",
    "MarketSnapshot",
    "PaperBook",
    "Proposal",
    "RiskLimits",
    "RiskState",
    "ScanResult",
    "evaluate",
    "scan_markets",
]

__version__ = "0.2.0"
