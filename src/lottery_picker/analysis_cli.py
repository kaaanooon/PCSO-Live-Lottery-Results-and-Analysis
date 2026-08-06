from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

from .analysis import (
    build_analysis,
    load_analysis_draws,
    select_latest_draws,
    write_analysis_bundle,
)
from .report import write_html_report


DEFAULT_INPUT = Path("lotto_results_all_games_oldest_to_latest_8_columns.csv")


def _date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("Use YYYY-MM-DD, for example 2026-08-05.") from exc


def _non_negative_int(value: str) -> int:
    try:
        parsed = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("Use a whole number.") from exc
    if parsed < 0:
        raise argparse.ArgumentTypeError("Value cannot be negative.")
    return parsed


def _one_to_five(value: str) -> int:
    parsed = _non_negative_int(value)
    if not 1 <= parsed <= 5:
        raise argparse.ArgumentTypeError("Choose between 1 and 5 latest draws.")
    return parsed


def _positive_int(value: str) -> int:
    parsed = _non_negative_int(value)
    if parsed == 0:
        raise argparse.ArgumentTypeError("Value must be greater than zero.")
    return parsed


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="lottery-analysis",
        description=(
            "Generate non-ML, date-range-based Philippine lottery statistics and "
            "historically profiled candidate combinations."
        ),
    )
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="Eight-column draw CSV.")
    parser.add_argument("--from", dest="start_date", type=_date, help="Inclusive start date.")
    parser.add_argument("--to", dest="end_date", type=_date, help="Inclusive end date.")
    parser.add_argument(
        "--latest-draws",
        type=_one_to_five,
        help="Analyze the latest 1-5 draws per logical game (default: 5 when no dates are given).",
    )
    parser.add_argument(
        "--candidates",
        type=_non_negative_int,
        default=10,
        help="Candidate combinations to generate per logical game (default: 10).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=20260806,
        help="Random seed used to reproduce the same candidates (default: 20260806).",
    )
    parser.add_argument(
        "--rolling-window",
        type=_positive_int,
        default=3,
        help="Draw window for short-term rolling frequency (default: 3).",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("analysis_output"),
        help="Directory for JSON and per-game CSV outputs.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        if args.latest_draws is not None and (args.start_date or args.end_date):
            parser.error("Use either --latest-draws or --from/--to, not both.")
        all_draws = load_analysis_draws(args.input)
        if args.start_date or args.end_date:
            if args.start_date and args.end_date and args.start_date > args.end_date:
                raise ValueError("Start date must be on or before end date.")
            start_date = args.start_date or min(draw.draw_date for draw in all_draws)
            end_date = args.end_date or max(draw.draw_date for draw in all_draws)
            draws = tuple(
                draw for draw in all_draws if start_date <= draw.draw_date <= end_date
            )
            selection_mode = "date"
            latest_per_game = None
        else:
            latest_per_game = args.latest_draws or 5
            draws = select_latest_draws(all_draws, latest_per_game)
            start_date = None
            end_date = None
            selection_mode = "latest"
        analysis = build_analysis(
            draws,
            candidate_count=args.candidates,
            seed=args.seed,
            requested_start_date=start_date,
            requested_end_date=end_date,
            rolling_window=args.rolling_window,
            available_draws=all_draws,
            selection_mode=selection_mode,
            latest_per_game=latest_per_game,
        )
        write_analysis_bundle(analysis, args.output_dir)
        write_html_report(analysis, args.output_dir / "lottery_analysis_report.html")
    except (OSError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    metadata = analysis["metadata"]
    print(
        f"Wrote {metadata['draw_count']:,} selected draws across nine logical games to "
        f"{args.output_dir.resolve()}"
    )
    print(metadata["candidate_disclaimer"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
