# Polymarket paper scanner

Read-only research tools for Polymarket. This package lists active markets and can read a few public order books. It does not place orders, sign transactions, or read a private key.

Verified against `polymarket-client` 0.17.0, the current official Python SDK. The older `py-clob-client` package is the legacy CLOB client; new work should use `polymarket-client`. See [Python SDK](https://docs.polymarket.com/getting-started/python) and [Migrate from legacy SDKs](https://docs.polymarket.com/migrate/clob-sdk-to-unified-sdk).

Polygon is the chain Polymarket uses (chain id 137 in the CLOB auth domain). This package never builds that signature. [API authentication](https://docs.polymarket.com/getting-started/api).

## What a scan does

```text
paper or shadow
      |
      v
PublicClient.list_markets          Gamma  https://gamma-api.polymarket.com
  closed=false
  liquidity_num_min = Y
  order=liquidity, highest first
  version v1 and v2
      |
      v
drop rows Gamma marks closed, inactive,
not accepting orders, or without an order book
      |
      v
PublicClient.get_order_book         CLOB   https://clob.polymarket.com
  YES asset only, first N markets
      |
      v
JSONL log + text table
```

Gamma is the market catalog. The CLOB is the order book. The Data API is how a later slice would read positions for a public wallet (`PublicClient.list_positions`, `GET /v2/positions` on `https://data-api.polymarket.com`). This scanner does not call it. [Discover markets](https://docs.polymarket.com/market-data/discover-markets), [prices and order books](https://docs.polymarket.com/market-data/prices-order-books), [market details](https://docs.polymarket.com/market-data/market-details), [Data API](https://docs.polymarket.com/api-reference/data-api/overview).

YES asset selection follows the official SDK rule: a CTF (v1) market uses `outcomes.yes.token_id`; a v2 market uses `outcomes.yes.position_id`. If both pairs are present, the token pair wins. Book bids are sorted ascending and asks descending, so the best price is the last level on each side.

Gamma's `liquidity` sort is Polymarket's own figure. It can put long-shot markets first when a lot of size is posted far from the touch. `bid_notional_usdc` and `ask_notional_usdc` sum the whole side (`price × size` on every level). The touch is `best_bid_size` and `best_ask_size`. A book with only one side has no midpoint; the table prints `one-sided`.

`paper` and `shadow` both run this same read. The log records which mode you asked for. Shadow does not simulate fills yet. There is no third mode.

## Layout

| Module | Role now | Later, only with approval |
| --- | --- | --- |
| `mode.py` | Refuses anything except paper and shadow, including `POLYMARKET_MODE=live` | Stays a hard stop |
| `scanner.py` | Gamma list + a few CLOB books | Unchanged reads |
| `books.py` | Best bid, best ask, midpoint, side notionals | Unchanged |
| `risk.py` | Pure checks. No network, no orders | Called before any paper fill is recorded |
| `logging_json.py` | One JSON object per line | Same log for later decisions |
| fair value | Not built. No edge is invented from price alone | Estimate P(YES), flag a gap of at least X |
| paper ledger | Not built | Record hypothetical fills that passed `risk.evaluate` |
| positions | Not built | Public Data API read for a wallet you name |
| live gateway | Not present | Requires a separate yes for that exact action |

## Risk rules already encoded

`RiskLimits` refuses to construct a looser policy:

- Per market: 1% to 2% of bankroll. Default 2% of a paper bankroll of 1,000 USDC, so 20 USDC.
- Open positions: 5 to 10. Default 8.
- Daily loss breaker: 1% to 10% of bankroll. Default 5% (50 USDC on the default bankroll). The request names the breaker without a figure; 5% is the stand-in until you pick another number inside that band.
- Liquidity: no proposal under Y. Default Y is 1,000 USDC, same as the scanner floor.
- Edge: when an estimate exists, the absolute gap must be at least X. Default X is 0.03 (3 cents on a 0–1 price). Until a fair-value model exists, `require_edge=True` refuses a proposal that has no estimate.

The scanner applies Y as a Gamma filter and stamps `liquidity_ok` on each row. It does not call `evaluate`, because a scan is not a proposal.

## Run

```bash
cd polymarket-paper
python -m pip install -e ".[dev]"
python -m polymarket_paper scan --limit 10 --book-reads 3 --min-liquidity 1000
```

`--mode shadow` writes the same scan with `mode` set to `shadow`. `--json` prints JSONL. `--log logs/scan.jsonl` also saves it. Logs are gitignored.

A row looks like:

```text
mode=paper  scanned=2026-11-07 14:40 PST  returned=10  examined=10  books=3  min_liquidity=1,000

question                                                          yes bid/ask          liq    clob mid  gate
Will something happen?                                            0.4000/0.4200      9,000      0.4200  pass
```

`clob mid` is blank when that row was past the book-read budget. `gate` is `thin` when Gamma liquidity is below Y.

## Tests

```bash
cd polymarket-paper
python -m pytest
```

Unit tests use fake markets. They do not hit the network. A source check fails if trading-client or key material shows up under `src/`.

## Not in this slice

- No fair-value model and no edge flags. A midpoint is the market price, not an estimate of fair probability.
- No paper fills and no shadow simulation.
- No wallet, no Data API position read, no CLOB credentials.
- No `SecureClient`, no private key, no order payload, no signature.

Say which of these you want next. Live order code stays unwritten until you approve that exact action.
