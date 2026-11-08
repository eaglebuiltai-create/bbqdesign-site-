# Polymarket paper research

Research tools for Polymarket. This package lists active markets, reads a few public order books, and keeps a local paper book of hypothetical fills. It does not place orders, sign transactions, or read a private key.

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

A separate local book records a hypothetical buy only after the risk checks pass. Shadow runs those checks and leaves the book unchanged.

Gamma is the market catalog. The CLOB is the order book. The Data API is how a later slice would read positions for a public wallet (`PublicClient.list_positions`, `GET /v2/positions` on `https://data-api.polymarket.com`). This scanner does not call it. [Discover markets](https://docs.polymarket.com/market-data/discover-markets), [prices and order books](https://docs.polymarket.com/market-data/prices-order-books), [market details](https://docs.polymarket.com/market-data/market-details), [Data API](https://docs.polymarket.com/api-reference/data-api/overview).

YES asset selection follows the official SDK rule: a CTF (v1) market uses `outcomes.yes.token_id`; a v2 market uses `outcomes.yes.position_id`. If both pairs are present, the token pair wins. Book bids are sorted ascending and asks descending, so the best price is the last level on each side.

Gamma's `liquidity` sort is Polymarket's own figure. It can put long-shot markets first when a lot of size is posted far from the touch. `bid_notional_usdc` and `ask_notional_usdc` sum the whole side (`price × size` on every level). The touch is `best_bid_size` and `best_ask_size`. A book with only one side has no midpoint; the table prints `one-sided`.

`paper` and `shadow` both run this same read. The log records which mode you asked for. There is no third mode.

## Layout

| Module | Role now | Later, only with approval |
| --- | --- | --- |
| `mode.py` | Refuses anything except paper and shadow, including `POLYMARKET_MODE=live` | Stays a hard stop |
| `scanner.py` | Gamma list + a few CLOB books | Unchanged reads |
| `books.py` | Best bid, best ask, midpoint, side notionals | Unchanged |
| `risk.py` | Pure checks. No network, no orders | Still the gate in front of every buy |
| `ledger.py` | Local paper book. A buy is written only after `evaluate` passes | Unchanged role |
| `logging_json.py` | One JSON object per line for scans and ledger decisions | Same log |
| fair value | Not built. No edge is invented from price alone | Estimate P(YES), flag a gap of at least X |
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

## Paper ledger

The book is a JSON file on this machine. It is not a Polymarket account, and the command does not call Gamma, the CLOB, or the Data API. Copy liquidity from a scan into `--liquidity`.

A buy is written only when every check is clear:

- `risk.evaluate` passes, including the per-market cap, the open-holding cap, the daily-loss breaker, the liquidity floor, and the edge rule when an edge is present.
- The price is above 0 and below 1.
- The book still has the cash.

`shadow` runs the same checks, prints the decision, and does not change cash or holdings. A refusal in `paper` mode also leaves holdings unchanged. Both write an audit line beside the book.

Selling and marking are local accounting. A sell reduces exposure, so a tripped breaker does not block it. Otherwise a paper loss could not be closed. Marks use prices from 0 to 1 so a resolved contract can be marked at 0 or 1. Only today's realized PnL and today's mark change count toward the breaker. The day boundary is Pacific time.

```bash
python -m polymarket_paper ledger init
python -m polymarket_paper ledger propose \
  --market-id 559677 --outcome yes \
  --notional 10 --price 0.42 --liquidity 5000
python -m polymarket_paper ledger mark --market-id 559677 --outcome yes --price 0.45
python -m polymarket_paper ledger close --market-id 559677 --outcome yes --price 0.45
python -m polymarket_paper ledger show
```

The default book is `logs/paper-ledger.json`, with decisions in `logs/paper-ledger.jsonl`. Both are gitignored. `--mode shadow` on `propose` does not create or change the book. Limit flags (`--bankroll`, `--max-fraction`, `--max-positions`, `--daily-loss`, `--min-liquidity`, `--min-edge`) apply only when a book is created. An existing book keeps the limits it was created with.

A buy that fails the checks still exits 0. The line `decision=refused` and the `reasons=` field say why. `decision=recorded` means the holding was written. `decision=allowed_not_recorded` means shadow would have written it.

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

Unit tests use fake markets and a fake order sender. They do not hit the network. The authenticated client is named only in `live.py`. No key value is stored in the source.

## One confirmed live order

`live-order` posts a single limit order through `SecureClient.place_limit_order` ([create order](https://docs.polymarket.com/trading/orders/create)). It stays closed unless all of these match that order:

- `POLYMARKET_MODE=live`
- `POLYMARKET_LIVE_ORDER=yes`
- `--confirm` is the exact phrase the command prints when the phrase is missing
- the same risk checks used by the paper book, including the 20 USDC per-market cap
- `POLYMARKET_PRIVATE_KEY` is set in the environment

The key is not a command argument and is not written to the log. The default order is post-only, so it rests on the book. `--cross` allows it to take liquidity. A scan or a paper-ledger command still refuses to run when `POLYMARKET_MODE=live`.

Run the command once without `--confirm` to see the phrase. That does not submit.

```bash
POLYMARKET_MODE=live POLYMARKET_LIVE_ORDER=yes \
  python -m polymarket_paper live-order \
  --market-id 559677 --asset-id ASSET --side BUY \
  --price 0.42 --size 10 --liquidity 5000 \
  --confirm "submit BUY 10 shares of ASSET at 0.42 for market 559677 post_only=true"
```

Put the signing key in `POLYMARKET_PRIVATE_KEY` yourself. This tree does not contain one, and this session does not submit an order.

## Not in this slice

- No fair-value model. Pass `--edge` only when you already have an estimate. `--require-edge` refuses a buy that has none.
- No wallet position sync from the Data API.
- No market orders, no cancel command, and no loop that submits more than one order.
