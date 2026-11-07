"""Command line for the read-only scanner.

Example:
    python -m polymarket_paper scan --limit 10 --book-reads 3
"""

from __future__ import annotations

import argparse
import os
import sys
from decimal import Decimal, InvalidOperation
from zoneinfo import ZoneInfo

from polymarket import PolymarketError, PublicClient

from polymarket_paper.config import ScanConfig
from polymarket_paper.logging_json import dumps_jsonl, write_jsonl
from polymarket_paper.mode import ResearchModeError, assert_research_mode
from polymarket_paper.models import MarketSnapshot, ScanResult
from polymarket_paper.scanner import scan_markets

PACIFIC = ZoneInfo("America/Los_Angeles")


def _decimal_arg(value: str) -> Decimal:
    try:
        parsed = Decimal(value)
    except InvalidOperation as exc:
        raise argparse.ArgumentTypeError(f"not a number: {value}") from exc
    return parsed


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="polymarket-paper",
        description=(
            "Read-only Polymarket scanner. Paper and shadow logs only. "
            "Does not place orders or sign transactions."
        ),
    )
    sub = parser.add_subparsers(dest="command", required=True)
    scan = sub.add_parser("scan", help="List active markets and optionally read a few books")
    scan.add_argument("--mode", choices=["paper", "shadow"], default="paper")
    scan.add_argument("--limit", type=int, default=20, help="Markets to return (default 20)")
    scan.add_argument(
        "--min-liquidity",
        type=_decimal_arg,
        default=Decimal("1000"),
        help="Gamma liquidity floor in USDC (default 1000)",
    )
    scan.add_argument(
        "--book-reads",
        type=int,
        default=5,
        help="How many YES order books to read from the CLOB (default 5)",
    )
    scan.add_argument(
        "--versions",
        default="v1,v2",
        help="Protocol versions, comma-separated (default v1,v2)",
    )
    scan.add_argument(
        "--json",
        action="store_true",
        help="Write JSONL to stdout instead of a text table",
    )
    scan.add_argument(
        "--log",
        default="",
        help="Also append JSONL to this file path",
    )
    return parser


def _guard_environment() -> None:
    env_mode = os.environ.get("POLYMARKET_MODE")
    if env_mode is not None:
        assert_research_mode(env_mode)


def _price(value: Decimal | None) -> str:
    if value is None:
        return "-"
    return f"{value:.4f}"


def _usdc(value: Decimal | None) -> str:
    if value is None:
        return "-"
    return f"{value:,.0f}"


def _clip(value: str | None, width: int) -> str:
    text = value or "(no question)"
    if len(text) <= width:
        return text
    if width <= 3:
        return text[:width]
    return text[: width - 3] + "..."


def _book_cell(market: MarketSnapshot) -> str:
    if market.book is not None:
        if market.book.midpoint is not None:
            return _price(market.book.midpoint)
        if market.book.best_bid is not None or market.book.best_ask is not None:
            return "one-sided"
        return "empty"
    if market.book_error:
        return "book error"
    if market.yes_asset_id is None:
        return "no asset"
    return "-"


def render_table(result: ScanResult) -> str:
    scanned = result.scanned_at.astimezone(PACIFIC)
    stamp = scanned.strftime("%Y-%m-%d %H:%M %Z")
    lines = [
        (
            f"mode={result.mode}  scanned={stamp}  "
            f"returned={len(result.markets)}  examined={result.examined}  "
            f"books={result.book_reads}  min_liquidity={_usdc(result.min_liquidity_usdc)}"
        ),
        "",
        f"{'question':<64}  {'yes bid/ask':<19}  {'liq':>10}  {'clob mid':>10}  gate",
    ]
    for market in result.markets:
        quote = f"{_price(market.gamma_best_bid)}/{_price(market.gamma_best_ask)}"
        gate = "pass" if market.liquidity_ok else "thin"
        lines.append(
            f"{_clip(market.question, 64):<64}  {quote:<19}  "
            f"{_usdc(market.liquidity_usdc):>10}  {_book_cell(market):>10}  {gate}"
        )
    if result.rate_limited:
        lines.append("")
        lines.append("CLOB rate limit reached. Remaining books were not read.")
    return "\n".join(lines)


def run_scan(args: argparse.Namespace) -> int:
    mode = assert_research_mode(args.mode)
    versions = tuple(part.strip() for part in str(args.versions).split(",") if part.strip())
    try:
        config = ScanConfig(
            mode=mode,
            limit=args.limit,
            min_liquidity_usdc=args.min_liquidity,
            book_reads=args.book_reads,
            versions=versions,
            max_examined=min(1000, max(args.limit * 10, args.limit)),
        )
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    try:
        with PublicClient() as client:
            result = scan_markets(client, config)
    except ResearchModeError:
        raise
    except PolymarketError as exc:
        print(f"error: Polymarket read failed: {exc}", file=sys.stderr)
        return 1

    if args.json:
        sys.stdout.write(dumps_jsonl(result))
    else:
        print(render_table(result))
    if args.log:
        from pathlib import Path

        write_jsonl(result, Path(args.log))
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    try:
        _guard_environment()
        if args.command == "scan":
            return run_scan(args)
    except ResearchModeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    parser.error(f"unknown command {args.command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
