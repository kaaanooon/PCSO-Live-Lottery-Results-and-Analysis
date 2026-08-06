from __future__ import annotations

from datetime import date
from typing import Protocol

from .errors import InvalidInputError
from .games import normalize_game_filter
from .models import DrawResult, FetchOutcome
from .providers.lottomatik import LottoMatikProvider


class ResultProvider(Protocol):
    name: str

    def fetch(self, start_date: date, end_date: date, game: str | None = None) -> list[DrawResult]: ...


LOTTOMATIK_DATA_WARNING = (
    "LottoMatik coverage starts in late December 2023, and some jackpot/winner "
    "values or draw slots can differ from the main PCSO results."
)


def _result_quality(result: DrawResult) -> tuple[bool, bool, bool]:
    source_id = result.source_id or ""
    canonical_id = "S" in source_id and not source_id.startswith(result.game_code.split("-")[0] * 2)
    return (result.jackpot > 0, result.winners > 0, canonical_id)


def _deduplicate_and_sort(
    results: list[DrawResult], *, oldest_first: bool = False
) -> tuple[DrawResult, ...]:
    unique: dict[tuple[str, date, str | None], DrawResult] = {}
    for result in results:
        existing = unique.get(result.identity)
        if existing is None or _result_quality(result) > _result_quality(existing):
            unique[result.identity] = result
    return tuple(
        sorted(
            unique.values(),
            key=lambda item: (item.draw_date, item.draw_time or "", item.game_code),
            reverse=not oldest_first,
        )
    )


class LotteryService:
    def __init__(
        self,
        *,
        lottomatik: ResultProvider | None = None,
    ) -> None:
        self.lottomatik = lottomatik or LottoMatikProvider()

    def fetch(
        self,
        start_date: date,
        end_date: date,
        *,
        game: str | None = None,
        order: str = "latest",
    ) -> FetchOutcome:
        if end_date < start_date:
            raise InvalidInputError("The end date cannot be before the start date.")
        normalize_game_filter(game)
        if order not in {"latest", "oldest"}:
            raise InvalidInputError("Order must be latest or oldest.")
        oldest_first = order == "oldest"

        results = self.lottomatik.fetch(start_date, end_date, game)
        provider_warnings = tuple(getattr(self.lottomatik, "last_warnings", ()))
        return FetchOutcome(
            _deduplicate_and_sort(results, oldest_first=oldest_first),
            (LOTTOMATIK_DATA_WARNING, *provider_warnings),
        )
