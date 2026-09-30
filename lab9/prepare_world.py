import csv
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SOURCE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/9380cca83db5f9aef52d5e762765100745f84b27/geojson/ne_50m_admin_0_countries.geojson"

raw = subprocess.check_output(["curl", "-fsSL", SOURCE])
world = json.loads(raw)
grouped = {}
for feature in world["features"]:
    properties = feature["properties"]
    iso3 = properties["ISO_A3_EH"]
    key = iso3 if len(iso3) == 3 and iso3.isalpha() else str(properties["NE_ID"])
    feature["properties"] = {
        "iso3": iso3,
        "name": properties["NAME_EN"],
        "id": str(properties["NE_ID"]),
        "label_lon": properties["LABEL_X"],
        "label_lat": properties["LABEL_Y"],
    }
    if key not in grouped:
        grouped[key] = feature
    else:
        target = grouped[key]
        if target["geometry"]["type"] == "Polygon":
            target["geometry"] = {"type": "MultiPolygon", "coordinates": [target["geometry"]["coordinates"]]}
        polygons = feature["geometry"]["coordinates"]
        target["geometry"]["coordinates"].extend([polygons] if feature["geometry"]["type"] == "Polygon" else polygons)
        if properties["ISO_A3"] == iso3:
            target["properties"] = feature["properties"]
world["features"] = list(grouped.values())
with (DATA / "lab9_gdp_2025_top50.csv").open(encoding="utf-8") as stream:
    rows = list(csv.DictReader(stream))
matches = {row["iso3"]: sum(feature["properties"]["iso3"] == row["iso3"] for feature in world["features"]) for row in rows}
assert len(rows) == len(matches) == 50
assert all(count == 1 for count in matches.values()), matches
(DATA / "lab9_world.geojson").write_text(json.dumps(world, ensure_ascii=False, separators=(",", ":")) + "\n")
(DATA / "lab9_sources.json").write_text(json.dumps({
    "accessed": "2026-09-30",
    "gdp_source": "https://raw.githubusercontent.com/hiilab/stats-401/main/data/lab9_gdp_2025_top50.csv",
    "gdp_description": "Course dataset based on IMF World Economic Outlook, October 2025; nominal GDP in current-price billions of US dollars.",
    "boundaries_source": SOURCE,
    "boundaries_description": "Natural Earth 1:50m Admin 0 Countries; ISO_A3_EH supplies ISO-3 codes, including FRA and NOR where ISO_A3 is missing. Features sharing a valid ISO-3 code are combined as one MultiPolygon; Australia's three features thus receive one GDP record. LABEL_X and LABEL_Y anchor the Dorling layout near each economy's main territory.",
    "boundaries_sha256": hashlib.sha256(raw).hexdigest(),
    "join_counts": matches,
    "features": len(world["features"]),
    "display": "Antarctica is omitted. Economies outside the course CSV remain missing, with no GDP-sized circle."
}, ensure_ascii=False, indent=2) + "\n")
print(f"Matched all {len(rows)} GDP records to exactly one geographic feature.")
