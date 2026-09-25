#!/usr/bin/env python3
"""Prepare the attributed, frozen Information is Beautiful CSV for the D3 explorer.

Rebuild offline: python3 individual-project/scripts/prepare_data.py
Acquire a new snapshot: python3 individual-project/scripts/prepare_data.py --refresh --date YYYY-MM-DD
Only Python's standard library and curl (for the optional download) are required.
"""

import argparse
import csv
import hashlib
import json
import re
import subprocess
from collections import Counter
from datetime import date
from decimal import Decimal
from pathlib import Path
from urllib.parse import urlparse

PROJECT = Path(__file__).resolve().parents[1]
SOURCE_URL = "https://docs.google.com/spreadsheets/d/1i0oIJJMRG-7t1GT-mr4smaTTU7988yXVz8nPlwaJ8Xk/export?format=csv&gid=2"
SHEET_URL = "https://docs.google.com/spreadsheets/d/1i0oIJJMRG-7t1GT-mr4smaTTU7988yXVz8nPlwaJ8Xk/edit#gid=2"
VIS_URL = "https://informationisbeautiful.net/visualizations/worlds-biggest-data-breaches-hacks/"
PLACEHOLDER_VALUES = {3_000_000, 4_000_000, 5_000_000, 10_000_000}

# The source row's narrative explicitly says the *quantity* is unknown. Do not
# match the word "unknown" alone (e.g., "unknown hackers" is not missing data).
UNKNOWN_QUANTITY_PATTERNS = (
    r"undisclosed amount", r"unknown amount", r"unknown number",
    r"undisclosed number", r"number of records taken is unknown",
)
SECTORS = {
    "web": "Web", "government": "Government", "retail": "Retail",
    "finance": "Finance", "health": "Health", "tech": "Technology",
    "telecoms": "Telecoms", "transport": "Transport", "gaming": "Gaming",
    "misc": "Other", "academia": "Education", "academic": "Education",
    "military": "Military", "media": "Media",
}
METHODS = {
    "hacked": "Hacked", "poor security": "Poor security",
    "lost device": "Lost device", "oops!": "Accidental exposure",
    "inside job": "Inside job",
}


def clean_text(value):
    return re.sub(r"\s+", " ", value).strip()


def parse_count(value):
    """Parse source count labels; never silently coerce malformed/unknown values."""
    text = value.strip().lower().strip('"“”')
    if not text or text in {"unknown", "n/a", "na", "?"}:
        return None
    if text == "one billion":
        return 1_000_000_000
    # The single semicolon typo occurs in Nissan's row; validate grouping first.
    if re.fullmatch(r"\d{1,3}(?:;\d{3})+", text):
        text = text.replace(";", ",")
    match = re.fullmatch(r"([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*(k|m|bn|b)?", text)
    if not match:
        raise ValueError(f"Unrecognized count label: {value!r}")
    multiplier = {None: 1, "k": 1000, "m": 1_000_000, "bn": 1_000_000_000, "b": 1_000_000_000}[match[2]]
    result = Decimal(match[1].replace(",", "")) * multiplier
    if result != result.to_integral_value() or result <= 0:
        raise ValueError(f"Count must be a positive integer: {value!r}")
    return int(result)


def narrative_corroborates(value, story):
    """Conservatively recognize an explicit count matching a possible placeholder.

    This confirms only that the supplied narrative repeats the value. It is not
    independent verification and deliberately does not infer counts from context.
    """
    for match in re.finditer(r"(?<![\w.])\d[\d,]*(?:\.\d+)?\s*(?:million|billion|bn|m|k)?\b", story.lower()):
        candidate = match[0].strip().replace("million", "m").replace("billion", "bn")
        try:
            if parse_count(candidate) == value:
                return True
        except ValueError:
            pass
    return False


def prepare_count(row):
    # This malformed value cannot safely be interpreted by deleting commas.
    # The row's linked article headline says 2.4 million (checked 2026-09-25).
    corrected_webtpa = row.get("ID") == "480" and row["records lost"] == "2,400,00"
    numeric = None if corrected_webtpa else parse_count(row["records lost"])
    displayed = row["displayed records"].strip()
    story = clean_text(row["story"])
    basis = "records-lost field"
    note = "Reported in the source compilation; not independently verified."
    status = "reported"
    count = numeric
    if row.get("ID") == "219" and "1025 point of sale systems" in story:
        count, status, basis = None, "unknown", "source count describes systems, not records"
        note = "The source narrative identifies 1,025 point-of-sale systems. That is not a count of stolen records, so this event stays searchable but is excluded from the numeric records axis."
    elif corrected_webtpa:
        count, status, basis = 2_400_000, "approximate", "linked-source correction of malformed numeric field"
        note = "The source sheet has malformed '2,400,00'. Its linked BleepingComputer article headline reports 2.4 million; that rounded count is used (article checked 2026-09-25)."
    elif displayed:
        count = parse_count(displayed)
        basis = "displayed-records field"
        if count is None:
            status = "unknown"
            basis = "explicit unknown in displayed-records field"
            note = "Source display says unknown; its numeric plotting value is not used."
        elif count != numeric or '"' in displayed or "one " in displayed:
            status = "approximate"
            note = "Uses the source's displayed count; its numeric plotting field differs. Both original fields are preserved."
        else:
            note = "Source display and numeric field agree; not independently verified."
    elif any(re.search(pattern, story, re.I) for pattern in UNKNOWN_QUANTITY_PATTERNS):
        count, status, basis = None, "unknown", "explicit unknown in source narrative"
        note = "Source narrative calls the quantity unknown or undisclosed; numeric field is not used."
    elif numeric in PLACEHOLDER_VALUES and not narrative_corroborates(numeric, story):
        count, status, basis = None, "unknown", "unresolved placeholder ambiguity"
        note = "The sheet permits 3m, 4m, 5m or 10m as placeholders for unknown counts. This row's display and narrative do not corroborate its numeric value, so it is retained as unresolved, not plotted on the numeric scale."
    if count is None:
        label = "Incomparable unit" if basis == "source count describes systems, not records" else ("Unresolved count" if basis == "unresolved placeholder ambiguity" else "Unknown count")
    else:
        label = ("≈ " if status == "approximate" else "") + f"{count:,}"
    return {
        "records": count, "recordsLabel": label, "recordsStatus": status,
        "recordsBasis": basis, "recordsNote": note,
        "recordsRaw": row["records lost"], "displayedRecordsRaw": row["displayed records"],
        "sourceRecords": numeric,
    }


def normalize_sector(raw):
    parts = [part.strip().lower() for part in raw.split(",") if part.strip()]
    normalized = [SECTORS[part] for part in parts]
    return (normalized[0] if len(set(normalized)) == 1 else "Multiple sectors"), normalized


def normalize_method(raw):
    parts = [part.strip().lower() for part in raw.split(",") if part.strip()]
    normalized = [METHODS[part] for part in parts]
    return (normalized[0] if len(set(normalized)) == 1 else "Multiple methods"), normalized


def prepare_rows(raw_path):
    with raw_path.open(encoding="utf-8-sig", newline="") as handle:
        csv_rows = list(csv.reader(handle))
    headers = [cell.strip() for cell in csv_rows[0]]
    instruction_rows = []
    events = []
    for sheet_row, cells in enumerate(csv_rows[1:], start=2):
        if len(cells) != len(headers):
            raise ValueError(f"Row {sheet_row}: unexpected column count")
        row = dict(zip(headers, cells))
        if not row["ID"].strip():
            if row["organisation"].startswith("visualisation here:"):
                instruction_rows.append(sheet_row)
                continue
            raise ValueError(f"Row {sheet_row}: missing event ID; cannot silently discard")
        if not re.fullmatch(r"\d+", row["ID"].strip()):
            raise ValueError(f"Row {sheet_row}: non-numeric source ID")
        if not re.fullmatch(r"20\d{2}", row["year"].strip()):
            raise ValueError(f"Row {sheet_row}: invalid year")
        sector, sector_components = normalize_sector(row["sector"])
        method, method_components = normalize_method(row["method"])
        source_name = clean_text(row["source name"])
        sources = []
        for field in ["1st source link", "2nd source link"]:
            url = row[field].strip()
            if not url:
                continue
            parsed = urlparse(url)
            if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                raise ValueError(f"Row {sheet_row}: invalid source URL")
            sources.append({"name": source_name if not sources and source_name else parsed.netloc.removeprefix("www."), "url": url})
        events.append({
            "id": "breach-" + row["ID"].strip(), "sourceId": row["ID"].strip(),
            "sourceRow": sheet_row, "organization": clean_text(row["organisation"]),
            "alternativeName": clean_text(row["alternative name"]),
            "year": int(row["year"]), "dateRaw": row["date"],
            **prepare_count(row), "sector": sector, "sectorRaw": row["sector"],
            "sectorComponents": sector_components, "method": method,
            "methodRaw": row["method"], "methodComponents": method_components,
            "sensitivity": int(row["data sensitivity"]) if row["data sensitivity"].strip() else None,
            "story": clean_text(row["story"]), "sources": sources,
        })
    if len({e["id"] for e in events}) != len(events):
        raise ValueError("Source IDs must be unique")
    return sorted(events, key=lambda e: (e["year"], int(e["sourceId"]))), len(csv_rows), instruction_rows


def build(raw_path, snapshot_date):
    events, total_csv_rows, instruction_rows = prepare_rows(raw_path)
    numeric = [e for e in events if e["records"] is not None]
    uncertain = [e for e in events if e["records"] is None]
    unresolved = [e for e in uncertain if e["recordsBasis"] == "unresolved placeholder ambiguity"]
    changed = [e for e in numeric if e["displayedRecordsRaw"] and e["records"] != e["sourceRecords"]]
    stats = {
        "eventCount": len(events), "numericCount": len(numeric),
        "unknownOrUnresolvedCount": len(uncertain),
        "explicitUnknownCount": sum(e["recordsBasis"].startswith("explicit unknown") for e in events),
        "explicitUnknownDisplayCount": sum(e["recordsBasis"] == "explicit unknown in displayed-records field" for e in events),
        "explicitUnknownNarrativeCount": sum(e["recordsBasis"] == "explicit unknown in source narrative" for e in events),
        "unresolvedPlaceholderCount": len(unresolved),
        "incompatibleUnitCount": sum(e["recordsBasis"] == "source count describes systems, not records" for e in events),
        "approximateCount": sum(e["recordsStatus"] == "approximate" for e in events),
        "displayedNumericOverrides": len(changed),
        "yearMin": min(e["year"] for e in events), "yearMax": max(e["year"] for e in events),
        "numericMin": min(e["records"] for e in numeric), "numericMax": max(e["records"] for e in numeric),
        "sectorCounts": dict(Counter(e["sector"] for e in events).most_common()),
        "methodCounts": dict(Counter(e["method"] for e in events).most_common()),
        "yearCounts": dict(sorted(Counter(e["year"] for e in events).items())),
        "missingStoryCount": sum(not e["story"] for e in events),
        "missingSourceCount": sum(not e["sources"] for e in events),
    }
    metadata = {
        "title": "World's Biggest Data Breaches & Hacks",
        "publisher": "Information is Beautiful", "snapshotDate": snapshot_date,
        "sourceUrl": VIS_URL, "sheetUrl": SHEET_URL, "csvUrl": SOURCE_URL,
        "rawFile": raw_path.name, "sha256": hashlib.sha256(raw_path.read_bytes()).hexdigest(),
        "yearMeaning": "Year the story broke, as labeled by the source sheet; retained without independently re-dating reports.",
        "unit": "Source-reported records; rows may describe accounts, personal records, documents or images. Not unique people.",
        "scope": "A curated collection of reported breaches, not a complete or representative census. Related reports may overlap; do not sum counts as unique people or infer a global incidence trend.",
        "countPolicy": "Prefer displayed-records numeric labels over the numeric plotting field. Keep explicit unknowns, uncorroborated possible placeholders, and incompatible system-count units null. Other source counts are reported, not independently verified.",
        "placeholderPolicy": "The source instructions allow 3m, 4m, 5m or 10m to approximate unknown counts. Without an explicit display label or matching quantity in the row's narrative, conservatively retain these as unresolved. This does not assert their true count is unknown.",
        "categoryPolicy": "Trim category whitespace, normalize academic/academia to Education, and retain multi-category records as Multiple sectors or Multiple methods; original values and component lists are retained.",
        "stats": stats,
    }
    audit = {
        "snapshotDate": snapshot_date, "totalCsvRowsIncludingHeader": total_csv_rows,
        "excludedInstructionRows": instruction_rows, "stats": stats,
        "uncertainCounts": [{k: e[k] for k in ("id", "organization", "year", "recordsRaw", "displayedRecordsRaw", "recordsBasis")} for e in uncertain],
        "numericOverrides": [{k: e[k] for k in ("id", "organization", "year", "recordsRaw", "displayedRecordsRaw", "records")} for e in changed],
        "typographicalCorrections": [{"id": e["id"], "field": "records lost", "from": e["recordsRaw"], "to": e["records"], "sourceUrl": e["sources"][0]["url"]} for e in events if ";" in e["recordsRaw"] or e["recordsRaw"] == "2,400,00"],
        "missingSources": [e["id"] for e in events if not e["sources"]],
    }
    return {"metadata": metadata, "events": events}, audit


def audit_markdown(data, audit):
    meta = data["metadata"]
    s = meta["stats"]
    lines = [
        "# Data audit", "", f"Snapshot: **{meta['snapshotDate']}**. [Original visualization]({VIS_URL}) · [Official source sheet]({SHEET_URL}).", "",
        f"The raw CSV has {audit['totalCsvRowsIncludingHeader']} rows: one header, one instruction row, and **{s['eventCount']} retained event rows**. All source event IDs are unique. No event row was dropped or deduplicated.", "",
        f"The source's story years span **{s['yearMin']}–{s['yearMax']}**. These are the sheet's 'year story broke' values, not independently reconciled event dates. This is a curated collection, so its time distribution does not estimate the worldwide incidence of breaches.", "",
        "## Count handling", "",
        f"**{s['numericCount']} rows have a usable numeric count. {s['unknownOrUnresolvedCount']} rows remain in the explorer but are excluded from a numeric size axis:**", "",
        f"- {s['explicitUnknownCount']} explicitly unknown or undisclosed counts: {s['explicitUnknownDisplayCount']} in the displayed-records field and {s['explicitUnknownNarrativeCount']} in the source narrative.",
        f"- {s['unresolvedPlaceholderCount']} unresolved values matching the source's 3m / 4m / 5m / 10m placeholder instructions, without a corroborating display label or matching quantity in the narrative. They may be real counts; the conservative treatment makes no claim that their true values are definitely unknown.", "",
        f"- {s['incompatibleUnitCount']} incompatible unit: Wendy's source count of 1,025 describes point-of-sale systems rather than stolen records. The row stays searchable with this explanation; it receives no numeric records-axis position.", "",
        f"When a displayed numeric label is present, it takes precedence over the numeric plotting field. **{s['displayedNumericOverrides']} rows change numeric value** under this rule. These are labeled approximate/source-displayed. The raw value, display label, selected basis and a note remain in each JSON record. Nissan's `53;000` typo is parsed as 53,000; the supplied source link also names 'over-53-000-employees'. WebTPA's malformed `2,400,00` is corrected to the rounded 2.4 million in its [linked article headline](https://www.bleepingcomputer.com/news/security/webtpa-data-breach-impacts-24-million-insurance-policyholders/), checked on the snapshot date, and labeled approximate.", "",
        "Examples: National Public Data is 2.7bn in the source display versus 1bn in its plotting field; Yahoo (2013) is 1bn versus 550m; Microsoft (2023) has a 10m plotting number but its display says unknown. Values are source-reported and have not been independently verified against every linked article.", "",
        f"Usable counts range from **{s['numericMin']:,} to {s['numericMax']:,}**. 'Records' can mean accounts, personal records, documents or images, depending on the source row. It is not a count of unique people. Related incidents/reports may overlap; no sum of records is presented as unique people.", "",
        "## Categories and provenance", "",
        "Category whitespace is trimmed, academic/academia are normalized to Education, and multi-category rows remain Multiple sectors / Multiple methods with all original components retained. No primary sector is invented for mixed records. The UI may group smaller sectors under Other if its legend explains the grouping.", "",
        f"{s['missingStoryCount']} rows have no story text and {s['missingSourceCount']} row has no external source link (Aimware). No story or URL is fabricated. Original event and sheet-row IDs, alternative names, raw categories, raw count fields, dates, sensitivity and available source links are retained.", "",
        "## Reproduce", "", "Run `python3 individual-project/scripts/prepare_data.py` to rebuild from the frozen CSV, or `python3 individual-project/scripts/prepare_data.py --refresh --date YYYY-MM-DD` to download a new dated snapshot. Run `python3 -m unittest discover -s individual-project/scripts -p 'test_*.py'` for parsing, missing-data and source-reconciliation checks.", "",
        f"Raw CSV SHA-256: `{meta['sha256']}`.", "",
        "The full lists of numeric overrides, unresolved/unknown rows, and the typo correction are in `audit.json`. The JSON is deliberately loaded as an external data file by the D3 page.", "",
    ]
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--date", default="2026-09-25", help="Frozen snapshot date, YYYY-MM-DD")
    parser.add_argument("--refresh", action="store_true", help="Download the official CSV before preparing it")
    args = parser.parse_args()
    date.fromisoformat(args.date)
    raw_path = PROJECT / "data" / f"breaches-source-{args.date}.csv"
    if args.refresh:
        subprocess.run(["curl", "--fail", "--location", "--silent", "--show-error", SOURCE_URL, "--output", str(raw_path)], check=True)
    if not raw_path.exists():
        parser.error(f"Missing snapshot {raw_path.name}; use --refresh to acquire it")
    data, audit = build(raw_path, args.date)
    for filename, payload in [("breaches.json", data), ("audit.json", audit)]:
        (PROJECT / "data" / filename).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (PROJECT / "data" / "README.md").write_text(audit_markdown(data, audit), encoding="utf-8")
    print(json.dumps(data["metadata"]["stats"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
