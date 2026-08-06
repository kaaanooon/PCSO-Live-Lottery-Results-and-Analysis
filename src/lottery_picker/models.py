from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any


@dataclass(frozen=True, slots=True)
class DrawResult:
    game_code: str
    game: str
    numbers: tuple[str, ...]
    draw_date: date
    draw_time: str | None
    jackpot: Decimal
    winners: int
    source_id: str | None = None

    @property
    def combination(self) -> str:
        return "-".join(self.numbers)

    @property
    def identity(self) -> tuple[str, date, str | None]:
        return (self.game_code, self.draw_date, self.draw_time)

    def to_dict(self) -> dict[str, Any]:
        return {
            "game_code": self.game_code,
            "game": self.game,
            "numbers": list(self.numbers),
            "combination": self.combination,
            "draw_date": self.draw_date.isoformat(),
            "draw_time": self.draw_time,
            "jackpot": format(self.jackpot, "f"),
            "winners": self.winners,
        }


@dataclass(frozen=True, slots=True)
class FetchOutcome:
    results: tuple[DrawResult, ...]
    warnings: tuple[str, ...] = ()
