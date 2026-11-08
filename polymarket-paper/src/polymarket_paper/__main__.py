"""Command line for the paper scanner and the paper ledger.

Examples:
    python -m polymarket_paper scan --limit 10 --book-reads 3
    python -m polymarket_paper ledger init
    python -m polymarket_paper ledger propose --market-id 123 --outcome yes \\
        --notional 10 --price 0.42 --liquidity 5000
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path
from zoneinfo import ZoneInfo

from polymarket import PolymarketError, PublicClient

from polymarket_paper.config import ScanConfig
from polymarket_paper.ledger import LedgerError, PaperBook, load_book, render_book, render_decision
from polymarket_paper.logging_json import append_jsonl, dumps_jsonl, write_jsonl
from polymarket_paper.mode import ResearchModeError, assert_research_mode
from polymarket_paper.models import MarketSnapshot, ScanResult
from polymarket_paper.risk import RiskLimits
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
            "Polymarket paper research tools. Scans public markets and records "
            "hypothetical fills locally. Does not place orders or sign transactions."
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
    ledger = sub.add_parser("ledger", help="Record hypothetical fills in a local paper book")
    ledger_sub = ledger.add_subparsers(dest="ledger_command", required=True)
    _add_ledger_init(ledger_sub)
    _add_ledger_show(ledger_sub)
    _add_ledger_propose(ledger_sub)
    _add_ledger_close(ledger_sub)
    _add_ledger_mark(ledger_sub)
    return parser


def _add_ledger_path(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--ledger",
        default="logs/paper-ledger.json",
        help="Paper book path (default logs/paper-ledger.json)",
    )


def _add_limit_flags(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--bankroll", type=_decimal_arg, help="Starting paper bankroll, used when creating a book")
    parser.add_argument("--max-fraction", type=_decimal_arg, help="Per-market cap as a fraction, from 0.01 to 0.02")
    parser.add_argument("--max-positions", type=int, help="Open-holding cap, from 5 to 10")
    parser.add_argument("--daily-loss", type=_decimal_arg, help="Daily loss breaker as a fraction, from 0.01 to 0.10")
    parser.add_argument("--min-edge", type=_decimal_arg, help="Minimum probability gap when an edge is supplied")


def _add_mode(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--mode", choices=["paper", "shadow"], default="paper")
    parser.add_argument("--json", action="store_true", help="Print the decision or book as JSON")
    parser.add_argument("--log", default="", help="JSONL audit path (default: beside the book)")


def _add_ledger_init(sub: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = sub.add_parser("init", help="Create an empty paper book")
    _add_ledger_path(parser)
    _add_limit_flags(parser)
    parser.add_argument(
        "--min-liquidity",
        type=_decimal_arg,
        help="Liquidity floor stored with the book",
    )


def _add_ledger_show(sub: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = sub.add_parser("show", help="Print cash, holdings, and recent fills")
    _add_ledger_path(parser)
    parser.add_argument("--json", action="store_true")


def _add_ledger_propose(sub: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = sub.add_parser("propose", help="Hypothetical buy, recorded only if risk checks pass")
    _add_ledger_path(parser)
    _add_mode(parser)
    _add_limit_flags(parser)
    parser.add_argument("--market-id", required=True)
    parser.add_argument("--outcome", required=True, choices=["yes", "no"])
    parser.add_argument("--notional", required=True, type=_decimal_arg, help="USDC to spend")
    parser.add_argument("--price", required=True, type=_decimal_arg, help="Price in (0, 1)")
    parser.add_argument("--liquidity", required=True, type=_decimal_arg, help="Market liquidity in USDC")
    parser.add_argument("--edge", type=_decimal_arg, help="Optional fair-value gap, signed")
    parser.add_argument("--require-edge", action="store_true")
    parser.add_argument("--question", default="")
    parser.add_argument("--min-liquidity", type=_decimal_arg, help="Liquidity floor stored with a new book")


def _add_ledger_close(sub: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = sub.add_parser("close", help="Hypothetical sell of an open holding")
    _add_ledger_path(parser)
    _add_mode(parser)
    parser.add_argument("--market-id", required=True)
    parser.add_argument("--outcome", required=True, choices=["yes", "no"])
    parser.add_argument("--price", required=True, type=_decimal_arg, help="Price in [0, 1]")
    parser.add_argument("--shares", type=_decimal_arg, help="Shares to sell (default: all)")


def _add_ledger_mark(sub: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = sub.add_parser("mark", help="Update the mark used by the daily-loss breaker")
    _add_ledger_path(parser)
    _add_mode(parser)
    parser.add_argument("--market-id", required=True)
    parser.add_argument("--outcome", required=True, choices=["yes", "no"])
    parser.add_argument("--price", required=True, type=_decimal_arg, help="Mark in [0, 1]")


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


def _limit_overrides(args: argparse.Namespace) -> dict[str, Decimal | int]:
    mapping: dict[str, Decimal | int] = {}
    if getattr(args, "bankroll", None) is not None:
        mapping["bankroll_usdc"] = args.bankroll
    if getattr(args, "max_fraction", None) is not None:
        mapping["max_fraction_per_market"] = args.max_fraction
    if getattr(args, "max_positions", None) is not None:
        mapping["max_open_positions"] = args.max_positions
    if getattr(args, "daily_loss", None) is not None:
        mapping["daily_loss_fraction"] = args.daily_loss
    if getattr(args, "min_liquidity", None) is not None:
        mapping["min_liquidity_usdc"] = args.min_liquidity
    if getattr(args, "min_edge", None) is not None:
        mapping["min_edge"] = args.min_edge
    return mapping


def _limits_for_new_book(args: argparse.Namespace) -> RiskLimits:
    return RiskLimits(**_limit_overrides(args))


def _reject_limit_changes(book: PaperBook, args: argparse.Namespace) -> None:
    overrides = _limit_overrides(args)
    for name, value in overrides.items():
        if getattr(book.limits, name) != value:
            raise LedgerError(
                "This book already has risk limits. "
                "Start another book with a different --ledger path."
            )


def _decision_log_path(args: argparse.Namespace) -> Path:
    if args.log:
        return Path(args.log)
    return Path(args.ledger).with_suffix(".jsonl")


def _emit_decision(args: argparse.Namespace, result: object) -> None:
    payload = result.to_json()  # type: ignore[attr-defined]
    if args.json:
        sys.stdout.write(json.dumps(payload, separators=(",", ":"), sort_keys=True) + "\n")
    else:
        print(render_decision(result))  # type: ignore[arg-type]
    append_jsonl(_decision_log_path(args), payload)


def _load_for_command(args: argparse.Namespace) -> tuple[PaperBook, Path, bool]:
    """Return the book, its path, and whether this command may save it."""

    path = Path(args.ledger)
    mode = assert_research_mode(getattr(args, "mode", "paper"))
    if path.exists():
        book = load_book(path)
        _reject_limit_changes(book, args)
    else:
        book = PaperBook.new(_limits_for_new_book(args))
    return book, path, mode == "paper"


def run_ledger_init(args: argparse.Namespace) -> int:
    path = Path(args.ledger)
    if path.exists():
        raise LedgerError(f"paper book already exists at {path}")
    book = PaperBook.new(_limits_for_new_book(args))
    book.save(path)
    if getattr(args, "json", False):
        sys.stdout.write(json.dumps(book.to_json(), indent=2, sort_keys=True) + "\n")
    else:
        print(render_book(book, path=path))
    return 0


def run_ledger_show(args: argparse.Namespace) -> int:
    path = Path(args.ledger)
    book = load_book(path)
    if args.json:
        sys.stdout.write(json.dumps(book.to_json(), indent=2, sort_keys=True) + "\n")
    else:
        print(render_book(book, path=path))
    return 0


def run_ledger_propose(args: argparse.Namespace) -> int:
    mode = assert_research_mode(args.mode)
    book, path, save = _load_for_command(args)
    result = book.propose_buy(
        mode=mode,
        market_id=args.market_id,
        outcome=args.outcome,
        notional_usdc=args.notional,
        price=args.price,
        liquidity_usdc=args.liquidity,
        edge=args.edge,
        question=args.question or None,
        require_edge=args.require_edge,
    )
    if save:
        book.save(path)
    _emit_decision(args, result)
    return 0


def run_ledger_close(args: argparse.Namespace) -> int:
    mode = assert_research_mode(args.mode)
    path = Path(args.ledger)
    book = load_book(path)
    result = book.close_position(
        mode=mode,
        market_id=args.market_id,
        outcome=args.outcome,
        price=args.price,
        shares=args.shares,
    )
    if mode == "paper":
        book.save(path)
    _emit_decision(args, result)
    return 0


def run_ledger_mark(args: argparse.Namespace) -> int:
    mode = assert_research_mode(args.mode)
    path = Path(args.ledger)
    book = load_book(path)
    result = book.mark(
        mode=mode,
        market_id=args.market_id,
        outcome=args.outcome,
        price=args.price,
    )
    if mode == "paper":
        book.save(path)
    _emit_decision(args, result)
    return 0


def run_ledger(args: argparse.Namespace) -> int:
    commands = {
        "init": run_ledger_init,
        "show": run_ledger_show,
        "propose": run_ledger_propose,
        "close": run_ledger_close,
        "mark": run_ledger_mark,
    }
    handler = commands.get(args.ledger_command)
    if handler is None:
        raise LedgerError(f"unknown ledger command {args.ledger_command}")
    return handler(args)


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    try:
        _guard_environment()
        if args.command == "scan":
            return run_scan(args)
        if args.command == "ledger":
            return run_ledger(args)
    except ResearchModeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    except LedgerError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    parser.error(f"unknown command {args.command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
