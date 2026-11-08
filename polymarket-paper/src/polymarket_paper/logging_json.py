"""JSONL records for a scan.

One object per line. The scan summary is first, then one line per market.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, TextIO

from polymarket_paper.models import ScanResult


def iter_records(result: ScanResult) -> list[dict[str, Any]]:
    summary = result.to_json()
    markets = summary.pop("markets")
    records = [summary]
    for market in markets:
        records.append({"type": "market", "mode": result.mode, **market})
    return records


def dumps_jsonl(result: ScanResult) -> str:
    return "".join(json.dumps(record, separators=(",", ":"), sort_keys=True) + "\n" for record in iter_records(result))


def append_jsonl(path: Path, record: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, separators=(",", ":"), sort_keys=True) + "\n")


def write_jsonl(result: ScanResult, target: TextIO | Path) -> None:
    payload = dumps_jsonl(result)
    if isinstance(target, Path):
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(payload, encoding="utf-8")
        return
    target.write(payload)
