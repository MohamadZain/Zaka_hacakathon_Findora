"""
Generates data/products.json and static/images/products/*.svg
Run once from the ai-shop/ directory: python data/generate_catalog.py
"""
import json
import os
import random

random.seed(42)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "static", "images", "products")
os.makedirs(IMG_DIR, exist_ok=True)

# retailer price tiers (QAR) and typical style
RETAILERS = {
    "H&M":         {"tier": "mid",     "accent": "#C9C2B4"},
    "Zara":        {"tier": "premium", "accent": "#D8D2C4"},
    "Nike":        {"tier": "premium", "accent": "#CFCABE"},
    "Adidas":      {"tier": "premium", "accent": "#D2CDBF"},
    "Max":         {"tier": "budget",  "accent": "#E1DBCC"},
    "LC Waikiki":  {"tier": "budget",  "accent": "#DDD6C6"},
}

TIER_PRICE_RANGE = {
    "budget":  (29, 79),
    "mid":     (49, 139),
    "premium": (89, 249),
}

CATEGORIES = {
    "shirt": {
        "label": "Shirt",
        "sizes": ["S", "M", "L", "XL"],
        "names": [
            "Oversized Cotton Tee", "Classic Crew Tee", "Relaxed Fit Shirt",
            "Boxy Cotton Tee", "Essential Crew Neck", "Heavyweight Tee",
            "Drop-Shoulder Tee", "Plain Cotton Shirt",
        ],
        "colors": ["White", "Off-White", "Black", "Stone", "Sand"],
        "retailers": ["H&M", "Zara", "Max", "LC Waikiki", "Nike", "Adidas"],
    },
    "pants": {
        "label": "Pants",
        "sizes": ["28", "30", "32", "34", "36"],
        "names": [
            "Wide-Leg Trousers", "Straight Fit Pants", "Relaxed Chino",
            "Tapered Trousers", "Cotton Twill Pants", "Wide Leg Cargo",
            "Loose Fit Trousers", "Basic Straight Pants",
        ],
        "colors": ["Black", "Charcoal", "Stone", "Navy", "Khaki"],
        "retailers": ["H&M", "Zara", "Max", "LC Waikiki"],
    },
    "shoes": {
        "label": "Shoes",
        "sizes": ["40", "41", "42", "43", "44"],
        "names": [
            "Court Sneaker", "Classic Runner", "Low-Top Sneaker",
            "Retro Trainer", "Everyday Sneaker", "Canvas Trainer",
        ],
        "colors": ["White", "White/Black", "Off-White", "Black"],
        "retailers": ["Nike", "Adidas", "H&M", "Zara"],
    },
    "bag": {
        "label": "Bag",
        "sizes": ["One Size"],
        "names": [
            "Canvas Tote", "Crossbody Bag", "Structured Tote",
            "Mini Shoulder Bag", "Everyday Backpack",
        ],
        "colors": ["Black", "Sand", "Stone", "Brown"],
        "retailers": ["Zara", "H&M", "Max"],
    },
    "watch": {
        "label": "Watch",
        "sizes": ["One Size"],
        "names": [
            "Minimal Steel Watch", "Classic Leather Strap Watch", "Sport Watch",
            "Round Dial Watch",
        ],
        "colors": ["Black", "Silver", "Brown", "Gold"],
        "retailers": ["Zara", "H&M", "Max"],
    },
}

STYLE_TAGS = ["oversized", "relaxed", "classic", "minimal", "streetwear", "casual"]

products = []
pid = 1

def make_price(retailer):
    tier = RETAILERS[retailer]["tier"]
    lo, hi = TIER_PRICE_RANGE[tier]
    return random.randrange(lo, hi, 2)

def make_svg(product_id, label, color, retailer, accent):
    # simple, tasteful placeholder: soft neutral card with garment label + retailer wordmark
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
  <rect width="400" height="500" fill="{accent}"/>
  <rect x="0" y="0" width="400" height="500" fill="#000000" opacity="0.02"/>
  <text x="200" y="235" font-family="Georgia, serif" font-size="22" fill="#33302B" text-anchor="middle" opacity="0.85">{label}</text>
  <text x="200" y="265" font-family="Georgia, serif" font-size="13" letter-spacing="2" fill="#5B5748" text-anchor="middle" opacity="0.7">{color.upper()}</text>
  <text x="200" y="470" font-family="Helvetica, Arial, sans-serif" font-size="12" letter-spacing="3" fill="#33302B" text-anchor="middle" opacity="0.55">{retailer.upper()}</text>
</svg>'''
    path = os.path.join(IMG_DIR, f"{product_id}.svg")
    with open(path, "w") as f:
        f.write(svg)

for cat_key, cat in CATEGORIES.items():
    for i, name in enumerate(cat["names"]):
        retailer = cat["retailers"][i % len(cat["retailers"])]
        color = cat["colors"][i % len(cat["colors"])]
        price = make_price(retailer)
        # visual match: premium/mid tend a bit higher on average but randomized
        base_match = {"premium": 88, "mid": 84, "budget": 79}[RETAILERS[retailer]["tier"]]
        visual_match = max(70, min(97, base_match + random.randint(-9, 9)))
        product_id = f"{cat_key}-{pid:03d}"
        product = {
            "id": product_id,
            "name": name,
            "category": cat_key,
            "category_label": cat["label"],
            "retailer": retailer,
            "image": f"/static/images/products/{product_id}.svg",
            "price": price,
            "currency": "QAR",
            "sizes": cat["sizes"],
            "color": color,
            "style": random.choice(STYLE_TAGS),
            "visual_match": visual_match,
            "product_url": f"https://example.com/{retailer.lower().replace(' ', '').replace('&','')}/{product_id}",
        }
        make_svg(product_id, cat["label"], color, retailer, RETAILERS[retailer]["accent"])
        products.append(product)
        pid += 1

out_path = os.path.join(ROOT, "data", "products.json")
with open(out_path, "w") as f:
    json.dump(products, f, indent=2)

print(f"Wrote {len(products)} products to {out_path}")
print(f"Wrote {len(products)} placeholder images to {IMG_DIR}")
