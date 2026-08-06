from __future__ import annotations

import csv
import io
import json
from pathlib import Path

from .errors import OutputError
from .models import FetchOutcome


def _table(outcome: FetchOutcome) -> str:
    headers = ("GAME", "COMBINATION", "DRAW DATE", "TIME", "JACKPOT (PHP)", "WINNERS")
    rows = [
        (
            result.game,
            result.combination,
            result.draw_date.isoformat(),
            result.draw_time or "-",
            f"{result.jackpot:,.2f}",
            f"{result.winners:,}",
        )
        for result in outcome.results
    ]
    if not rows:
        return "No results found."
    widths = [max(len(headers[index]), *(len(row[index]) for row in rows)) for index in range(len(headers))]

    def render(row: tuple[str, ...]) -> str:
        return " | ".join(value.ljust(widths[index]) for index, value in enumerate(row))

    separator = "-+-".join("-" * width for width in widths)
    return "\n".join((render(headers), separator, *(render(row) for row in rows)))


def _json(outcome: FetchOutcome) -> str:
    return json.dumps(
        {
            "count": len(outcome.results),
            "warnings": list(outcome.warnings),
            "results": [result.to_dict() for result in outcome.results],
        },
        indent=2,
        ensure_ascii=False,
    )


def _csv(outcome: FetchOutcome) -> str:
    buffer = io.StringIO(newline="")
    fieldnames = [
        "game_code",
        "game",
        "numbers",
        "combination",
        "draw_date",
        "draw_time",
        "jackpot",
        "winners",
    ]
    writer = csv.DictWriter(buffer, fieldnames=fieldnames)
    writer.writeheader()
    for result in outcome.results:
        row = result.to_dict()
        row["numbers"] = json.dumps(row["numbers"])
        writer.writerow(row)
    return buffer.getvalue()


def render_output(outcome: FetchOutcome, output_format: str) -> str:
    if output_format == "table":
        return _table(outcome)
    if output_format == "json":
        return _json(outcome)
    if output_format == "csv":
        return _csv(outcome)
    raise ValueError(f"Unsupported output format: {output_format}")


def write_output(content: str, destination: Path | None) -> None:
    if destination is None:
        print(content)
        return
    try:
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(content, encoding="utf-8", newline="")
    except OSError as exc:
        raise OutputError(f"Could not write {destination}: {exc}") from exc
