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
py -m venv venv
venv\Scripts\activate
# pip install -r requirements.txt
py -m pip install -r requirements.txt 
py app.py
```

Open http://127.0.0.1:5000


## Flow

Landing → Upload (or "Use demo image") → item detection & selection →
per-item sizes → budget + shopping source → **Analyze & Find Options**
(simulated analysis animation) → results, with three tabs — **Closest Match /
Best Value / Best Price** — each showing its top 3 → change budget →
Recalculate → tabs update. "Shop In Store" shows nearby malls per retailer.

The uploaded/demo reference image stays visible as a thumbnail in the top bar
from the sizes step onward, and full-size on the upload/detect step.

## How recommendations work (`app.py`)

One candidate pool is built per request, then ranked three different ways —
no repeated "AI calls":

1. **Hard filters** — category, selected size, and shopping source
   (`all` / `online` / `qatar`, where "Qatar Stores" restricts to retailers
   with a physical Qatar presence).
2. **Combinations** — for multi-item selections, all valid per-category
   product combinations are generated from that one filtered pool (capped for
   performance).
3. **Budget is a hard constraint** — combinations within budget are preferred;
   if none exist, the closest options above budget are returned instead of an
   empty result, with a "No exact match found under budget" message.
4. **Same pool, three rankings**, each returning its top 3:
   - *Closest Match*: highest average visual match.
   - *Best Value*: balances normalized visual match and price.
   - *Best Price*: lowest total price (still constrained to the right
     category/size, so it never surfaces an unrelated cheap item).

Regenerate the mock catalog (shirt/pants/shoes/bag/watch across 8 retailers —
H&M, Zara, Nike, Adidas, Max, LC Waikiki, SHEIN, Temu) with:

```bash
python data/generate_catalog.py
```

## Notes

- Image "detection" is mocked (`/api/analyze`) — it returns a fixed set of
  detectable items and occasionally simulates low confidence, to exercise the
  manual-confirm UI. Swap in a real multimodal vision call later without
  touching the rest of the flow.
- Product photography uses real remote stock photo URLs (Unsplash CDN),
  stored per-product in `data/products.json` under `image`, so they're easy
  to swap for real retailer imagery later.
- No external AI APIs, no API keys, no auth, cart, checkout, payments,
  credits, or database — out of scope by design.
