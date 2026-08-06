from __future__ import annotations

import argparse
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from . import __version__
from .errors import LotteryPickerError
from .output import render_output, write_output
from .providers.lottomatik import LottoMatikProvider
from .service import LotteryService


def _date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("Use YYYY-MM-DD, for example 2026-08-05.") from exc


def build_parser(today: date | None = None) -> argparse.ArgumentParser:
    if today is None:
        try:
            manila_timezone = ZoneInfo("Asia/Manila")
        except ZoneInfoNotFoundError:
            manila_timezone = timezone(timedelta(hours=8))
        manila_today = datetime.now(manila_timezone).date()
    else:
        manila_today = today
    parser = argparse.ArgumentParser(
        prog="lottery-picker",
        description="Fetch Philippine lottery draw results from LottoMatik.",
    )
    parser.add_argument("--from", dest="start_date", type=_date, default=manila_today - timedelta(days=3))
    parser.add_argument("--to", dest="end_date", type=_date, default=manila_today)
    parser.add_argument(
        "--game",
        default="all",
        help="Game code/name, such as UL58, 6/42, 3DL, 3DL-2PM, or all.",
    )
    parser.add_argument("--format", choices=("table", "json", "csv"), default="table")
    parser.add_argument(
        "--order",
        choices=("latest", "oldest"),
        default="latest",
        help="Sort newest-first or oldest-first (default: latest).",
    )
    parser.add_argument("--output", type=Path, help="Write output to a file instead of stdout.")
    parser.add_argument(
        "--allow-partial",
        action="store_true",
        help="Allow LottoMatik to return an incomplete range older than its archive.",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    lottomatik = LottoMatikProvider(allow_partial=args.allow_partial)
    service = LotteryService(lottomatik=lottomatik)
    try:
        outcome = service.fetch(
            args.start_date,
            args.end_date,
            game=args.game,
            order=args.order,
        )
        write_output(render_output(outcome, args.format), args.output)
        for warning in outcome.warnings:
            print(f"warning: {warning}", file=sys.stderr)
        return 0
    except (LotteryPickerError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    finally:
        lottomatik.close()
