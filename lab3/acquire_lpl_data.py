"""Acquire and prepare 2025 LPL player-game records for STATS 401 Lab 3.

The data originates from Oracle's Elixir professional match data. The normal
run makes one request for the public annual CSV; a delayed fallback is used
only if that download fails.
"""

from __future__ import annotations

import tempfile
import time
from pathlib import Path

import pandas as pd
import requests


SOURCE_PAGE = "https://oracleselixir.com/tools/downloads"
SOURCE_DOWNLOAD_URLS = [
    (
        "https://raw.githubusercontent.com/cbplexiglass/"
        "LoL-Esports-Regional-Analyses/main/"
        "2025_LoL_esports_match_data_from_OraclesElixir.csv"
    ),
    (
        "https://drive.usercontent.google.com/download"
        "?id=1v6LRphp2kYciU4SXp0PCjEMuev1bDejc&export=download&confirm=t"
    ),
]
USER_AGENT = "STATS401-Lab3-LPL-Project/1.0 (educational data acquisition)"
MINIMUM_RECORDS = 1_000
RETRY_DELAY_SECONDS = 2
PLAYER_POSITIONS = ["top", "jng", "mid", "bot", "sup"]

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "data" / "lab3_lpl_2025.csv"

SOURCE_COLUMNS = [
    "gameid",
    "league",
    "year",
    "split",
    "date",
    "game",
    "patch",
    "participantid",
    "side",
    "position",
    "playername",
    "teamname",
    "champion",
    "gamelength",
    "result",
    "kills",
    "deaths",
    "assists",
    "damagetochampions",
    "totalgold",
    "total cs",
]


def download_source(destination: Path) -> None:
    """Download the annual source with error handling and delayed fallback."""

    headers = {"User-Agent": USER_AGENT}
    last_error: Exception | None = None

    for attempt, download_url in enumerate(SOURCE_DOWNLOAD_URLS, start=1):
        try:
            with requests.get(
                download_url,
                headers=headers,
                stream=True,
                timeout=(10, 300),
            ) as response:
                response.raise_for_status()
                with destination.open("wb") as output_file:
                    for chunk in response.iter_content(chunk_size=1024 * 1024):
                        if chunk:
                            output_file.write(chunk)

            with destination.open("rb") as downloaded_file:
                if not downloaded_file.read(7).startswith(b"gameid,"):
                    raise RuntimeError("The download did not contain the expected CSV header.")

            print(f"Downloaded source file ({destination.stat().st_size:,} bytes).")
            return
        except (requests.RequestException, OSError, RuntimeError) as error:
            last_error = error
            delay = RETRY_DELAY_SECONDS * attempt
            print(f"Attempt {attempt} failed: {error}")
            if attempt < len(SOURCE_DOWNLOAD_URLS):
                print(f"Waiting {delay} seconds before trying the fallback download.")
                time.sleep(delay)

    raise RuntimeError("Unable to download the LPL source data.") from last_error


def prepare_lpl_records(source_path: Path) -> pd.DataFrame:
    """Select valid LPL player rows and create a compact webpage dataset."""

    raw = pd.read_csv(source_path, usecols=SOURCE_COLUMNS, low_memory=False)
    player_rows = raw[
        (raw["league"] == "LPL")
        & (raw["year"] == 2025)
        & (raw["position"].isin(PLAYER_POSITIONS))
    ].copy()

    required_values = [
        "gameid",
        "date",
        "teamname",
        "playername",
        "champion",
        "result",
        "kills",
        "deaths",
        "assists",
        "damagetochampions",
        "totalgold",
        "total cs",
    ]
    player_rows = player_rows.dropna(subset=required_values)
    player_rows["date"] = pd.to_datetime(player_rows["date"], errors="coerce")
    player_rows = player_rows.dropna(subset=["date"])
    player_rows = player_rows.sort_values(
        ["date", "gameid", "participantid"], kind="stable"
    ).reset_index(drop=True)

    if len(player_rows) < MINIMUM_RECORDS:
        raise RuntimeError(
            f"Only {len(player_rows):,} valid LPL records were found; "
            f"the assignment requires at least {MINIMUM_RECORDS:,}."
        )

    return pd.DataFrame(
        {
            "record_id": [f"LPL2025-{index:04d}" for index in range(1, len(player_rows) + 1)],
            "league": player_rows["league"],
            "date": player_rows["date"].dt.strftime("%Y-%m-%d"),
            "split": player_rows["split"].fillna("Unknown"),
            "game_id": player_rows["gameid"],
            "game_number": player_rows["game"].astype(int),
            "patch": player_rows["patch"].map(lambda value: f"{float(value):.2f}"),
            "side": player_rows["side"],
            "team": player_rows["teamname"],
            "player": player_rows["playername"],
            "position": player_rows["position"],
            "champion": player_rows["champion"],
            "outcome": player_rows["result"].map({1: "Win", 0: "Loss"}),
            "kills": player_rows["kills"].astype(int),
            "deaths": player_rows["deaths"].astype(int),
            "assists": player_rows["assists"].astype(int),
            "kda": (
                (player_rows["kills"] + player_rows["assists"])
                / player_rows["deaths"].clip(lower=1)
            ).round(2),
            "total_gold": player_rows["totalgold"].astype(int),
            "total_cs": player_rows["total cs"].astype(int),
            "damage_to_champions": player_rows["damagetochampions"].astype(int),
            "game_minutes": (player_rows["gamelength"] / 60).round(1),
        }
    )


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="stats401-lpl-") as temporary_directory:
        source_path = Path(temporary_directory) / "oracle_elixir_2025.csv"
        download_source(source_path)
        records = prepare_lpl_records(source_path)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    records.to_csv(OUTPUT_PATH, index=False)
    print(f"Saved {len(records):,} LPL player-game records to {OUTPUT_PATH}.")
    print(f"Source: {SOURCE_PAGE}")


if __name__ == "__main__":
    main()
