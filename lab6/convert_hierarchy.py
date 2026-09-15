import csv
import json
from pathlib import Path


def build_hierarchy(rows, levels):
    if len(levels) == 1:
        return [
            {
                "name": row[levels[0]],
                "gdp": float(row["gdp_billion_usd"]),
                "status": row["gdp_status"],
            }
            for row in rows
        ]

    groups = {}
    for row in rows:
        groups.setdefault(row[levels[0]], []).append(row)

    return [
        {"name": name, "children": build_hierarchy(group, levels[1:])}
        for name, group in groups.items()
    ]


def main():
    data_directory = Path(__file__).resolve().parent.parent / "data"
    with (data_directory / "lab6_assignment_gdp.csv").open(
        encoding="utf-8-sig", newline=""
    ) as source:
        rows = list(csv.DictReader(source))

    hierarchy = {
        "name": "World",
        "children": build_hierarchy(rows, ["continent", "area", "country"]),
    }

    (data_directory / "lab6_assignment_gdp.json").write_text(
        json.dumps(hierarchy, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
