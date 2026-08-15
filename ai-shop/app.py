"""
AI Visual Shopping Assistant — hackathon prototype backend.

Flow: upload -> detect -> select -> analyze -> sizes -> budget/priority -> results -> recalculate
No auth, no cart, no payments, no database. Products come from data/products.json.
"""
import itertools
import json
import os
import random

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PRODUCTS_PATH = os.path.join(BASE_DIR, "data", "products.json")

with open(PRODUCTS_PATH, "r") as f:
    PRODUCTS = json.load(f)

PRODUCTS_BY_CATEGORY = {}
for p in PRODUCTS:
    PRODUCTS_BY_CATEGORY.setdefault(p["category"], []).append(p)

# Items we can "detect" in an uploaded photo, for the demo.
DETECTABLE_ITEMS = [
    {"category": "shirt", "label": "Shirt", "icon": "👕"},
    {"category": "pants", "label": "Pants", "icon": "👖"},
    {"category": "shoes", "label": "Shoes", "icon": "👟"},
    {"category": "bag", "label": "Bag", "icon": "👜"},
    {"category": "watch", "label": "Watch", "icon": "⌚"},
]

MALLS = [
    {
        "name": "Doha Festival City",
        "retailers": ["H&M", "Zara", "Nike", "Adidas"],
    },
    {
        "name": "Villaggio Mall",
        "retailers": ["Zara", "Max", "LC Waikiki"],
    },
    {
        "name": "Mall of Qatar",
        "retailers": ["H&M", "Adidas", "Max"],
    },
]


# ---------------------------------------------------------------------------
# Recommendation engine
# ---------------------------------------------------------------------------

def filter_candidates(category, size, brand):
    """Hard-filter products in a category by size and optional brand."""
    candidates = PRODUCTS_BY_CATEGORY.get(category, [])
    out = []
    for p in candidates:
        if size and size != "One Size" and size not in p["sizes"]:
            continue
        if brand and brand != "No Preference" and p["retailer"] != brand:
            continue
        out.append(p)
    # Fallback: if brand filter wiped out a category, ignore brand for that category
    if not out and brand and brand != "No Preference":
        out = [p for p in candidates if not size or size == "One Size" or size in p["sizes"]]
    return out


def build_combinations(selected_items, sizes, brand, max_per_category=6, max_combos=4000):
    """selected_items: list of category keys. sizes: {category: size}.
    Returns list of combos, each combo is a list of product dicts (one per category)."""
    per_category_lists = []
    for cat in selected_items:
        size = sizes.get(cat)
        candidates = filter_candidates(cat, size, brand)
        if not candidates:
            return []
        # cap candidates per category to keep the cartesian product small
        candidates = sorted(candidates, key=lambda p: -p["visual_match"])[:max_per_category]
        per_category_lists.append(candidates)

    combos = []
    for combo in itertools.product(*per_category_lists):
        combos.append(list(combo))
        if len(combos) >= max_combos:
            break
    return combos


def score_combo(combo):
    total_price = sum(p["price"] for p in combo)
    avg_match = sum(p["visual_match"] for p in combo) / len(combo)
    return total_price, avg_match


def pick_best_match(combos, budget):
    """Closest Match: maximize visual match, prefer within budget."""
    in_budget = [c for c in combos if score_combo(c)[0] <= budget]
    pool = in_budget if in_budget else combos
    return max(pool, key=lambda c: score_combo(c)[1])


def pick_best_price(combos, budget):
    """Best Price: minimize total price."""
    in_budget = [c for c in combos if score_combo(c)[0] <= budget]
    pool = in_budget if in_budget else combos
    return min(pool, key=lambda c: score_combo(c)[0])


def pick_best_value(combos, budget):
    """Best Value: balance of visual match and price, normalized 0-1."""
    prices = [score_combo(c)[0] for c in combos]
    matches = [score_combo(c)[1] for c in combos]
    lo_p, hi_p = min(prices), max(prices)
    lo_m, hi_m = min(matches), max(matches)

    def value_score(c):
        price, match = score_combo(c)
        price_norm = 0.0 if hi_p == lo_p else (price - lo_p) / (hi_p - lo_p)
        match_norm = 1.0 if hi_m == lo_m else (match - lo_m) / (hi_m - lo_m)
        return match_norm * 0.5 + (1 - price_norm) * 0.5

    in_budget = [c for c in combos if score_combo(c)[0] <= budget]
    pool = in_budget if in_budget else combos
    return max(pool, key=value_score)


def combo_to_result(combo, label, budget):
    total_price, avg_match = score_combo(combo)
    return {
        "label": label,
        "items": combo,
        "total_price": total_price,
        "currency": combo[0]["currency"] if combo else "QAR",
        "visual_match": round(avg_match),
        "over_budget": total_price > budget,
    }


def generate_results(selected_items, sizes, budget, priority, brand):
    combos = build_combinations(selected_items, sizes, brand)
    if not combos:
        return None

    best_match = pick_best_match(combos, budget)
    best_price = pick_best_price(combos, budget)
    best_value = pick_best_value(combos, budget)

    # De-duplicate: if two strategies land on the identical combo, that's fine for
    # a small catalog demo, but nudge best_price to be genuinely distinct when possible.
    def combo_ids(c):
        return tuple(sorted(p["id"] for p in c))

    if combo_ids(best_price) == combo_ids(best_match):
        cheaper_alts = sorted(combos, key=lambda c: score_combo(c)[0])
        for alt in cheaper_alts:
            if combo_ids(alt) != combo_ids(best_match):
                best_price = alt
                break

    results = [
        combo_to_result(best_match, "Best Match", budget),
        combo_to_result(best_value, "Best Value", budget),
        combo_to_result(best_price, "Best Price", budget),
    ]

    any_in_budget = any(not r["over_budget"] for r in results)
    return {
        "results": results,
        "any_in_budget": any_in_budget,
        "priority": priority,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/analyze", methods=["POST"])
def api_analyze():
    """Mocked detection step. In production this would call a multimodal model
    on the uploaded image. Here we return a consistent demo detection result."""
    # Randomly simulate a low-confidence read ~1 in 8 times, per the "bad image
    # handling" requirement, so the manual-confirm path is reachable in the demo.
    confident = random.random() > 0.125
    return jsonify({
        "confident": confident,
        "items": DETECTABLE_ITEMS,
    })


@app.route("/api/products", methods=["GET"])
def api_products():
    return jsonify(PRODUCTS)


@app.route("/api/recommend", methods=["POST"])
def api_recommend():
    data = request.get_json(force=True) or {}
    selected_items = data.get("items", [])
    sizes = data.get("sizes", {})
    budget = float(data.get("budget", 0) or 0)
    priority = data.get("priority", "Best Value")
    brand = data.get("brand", "No Preference")

    if not selected_items:
        return jsonify({"error": "No items selected."}), 400

    payload = generate_results(selected_items, sizes, budget, priority, brand)
    if payload is None:
        return jsonify({"error": "No products match your selection and sizes."}), 404

    return jsonify(payload)


@app.route("/api/recalculate", methods=["POST"])
def api_recalculate():
    data = request.get_json(force=True) or {}
    selected_items = data.get("items", [])
    sizes = data.get("sizes", {})
    old_budget = float(data.get("old_budget", 0) or 0)
    new_budget = float(data.get("new_budget", 0) or 0)
    priority = data.get("priority", "Best Value")
    brand = data.get("brand", "No Preference")

    if not selected_items:
        return jsonify({"error": "No items selected."}), 400

    payload = generate_results(selected_items, sizes, new_budget, priority, brand)
    if payload is None:
        return jsonify({"error": "No products match your selection and sizes."}), 404

    if new_budget < old_budget:
        message = (
            f"Your budget changed, so we found a cheaper combination "
            f"while keeping the overall look as similar as possible."
        )
    elif new_budget > old_budget:
        message = (
            f"Your budget went up, so we found stronger visual matches within the new range."
        )
    else:
        message = "Budget unchanged — here are your options again."

    payload["message"] = message
    return jsonify(payload)


@app.route("/api/malls", methods=["GET"])
def api_malls():
    return jsonify(MALLS)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
