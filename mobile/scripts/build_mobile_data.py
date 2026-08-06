"""Build the compact, offline-first draw archive bundled with the Expo app."""

from __future__ import annotations

import csv
import json
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SOURCE = PROJECT_ROOT / "lotto_results_all_games_oldest_to_latest_8_columns.csv"
DESTINATION = PROJECT_ROOT / "mobile" / "src" / "data" / "lottery-results.json"


def logical_code(game_code: str) -> str:
    if game_code.startswith("2DL-"):
        return "2DL"
    if game_code.startswith("3DL-"):
        return "3DL"
    return game_code


def main() -> None:
    draws: list[list[object]] = []
    with SOURCE.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            game_code = row["game_code"]
            draws.append(
                [
                    logical_code(game_code),
                    game_code,
                    row["draw_date"],
                    row["draw_time"][:5],
                    [int(value) for value in json.loads(row["numbers"])],
                    row["jackpot"] or "0",
                    int(row["winners"] or 0),
                ]
            )

    draws.sort(key=lambda row: (str(row[2]), str(row[3]), str(row[1])))
    payload = {
        "schemaVersion": 1,
        "source": "LottoMatik",
        "timezone": "Asia/Manila",
        "availableFrom": min(str(row[2]) for row in draws),
        "availableTo": max(str(row[2]) for row in draws),
        "drawCount": len(draws),
        "draws": draws,
    }
    DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    DESTINATION.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Wrote {len(draws):,} draws to {DESTINATION}")


if __name__ == "__main__":
    main()
