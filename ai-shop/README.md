# Fetch — AI Visual Shopping Assistant (hackathon prototype)

"You see it. You choose it. AI finds the way."

An AI shopping decision engine, not a stylist: you see a look, tell us exactly
which pieces you want, your budget, sizes and priority, and we return the best
buyable combinations from a mock multi-retailer catalog.

## Stack

- Backend: Python + Flask (`app.py`), no database — reads `data/products.json`
- Frontend: plain HTML/CSS/JS (`templates/index.html`, `static/`)

## Run it

```bash
python -m venv venv
Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Open http://127.0.0.1:5000

## Flow

Landing → Upload (or "Use demo image") → item detection & selection →
brief analyze animation → per-item sizes → budget + priority + optional brand →
results (Best Match / Best Value / Best Price cards) → change budget →
Recalculate → new combination. "Shop In Store" shows nearby malls per retailer.

## How recommendations work (`app.py`)

1. **Hard filters** — category, selected size, and brand (if chosen).
2. **Combinations** — for multi-item selections, all valid per-category
   product combinations are generated (capped for performance).
3. **Ranking** — three deterministic strategies score every combination:
   - *Best Match*: maximizes average visual match, preferring combos within budget.
   - *Best Price*: minimizes total price.
   - *Best Value*: balances normalized visual match and price.
4. If nothing fits the budget, the closest option is returned and flagged
   `over_budget` instead of hiding results.

Regenerate the mock catalog (31 products across shirt/pants/shoes/bag/watch,
6 retailers) with:

```bash
python data/generate_catalog.py
```

## Notes

- Image "detection" is mocked (`/api/analyze`) — it returns a fixed set of
  detectable items and occasionally simulates low confidence, to exercise the
  manual-confirm UI. Swap in a real multimodal vision call later without
  touching the rest of the flow.
- Product photography is procedurally generated neutral placeholder SVGs
  (`data/generate_catalog.py`) so the demo runs fully offline.
- No auth, cart, checkout, payments, or database — out of scope by design.


#1234