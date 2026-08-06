from __future__ import annotations

import re
from dataclasses import dataclass

from .errors import InvalidInputError


@dataclass(frozen=True, slots=True)
class Game:
    code: str
    name: str
    lottomatik_code: str
    draw_time: str | None = None


GAMES: tuple[Game, ...] = (
    Game("UL58", "Ultra Lotto 6/58", "UL58", "21:00"),
    Game("GL55", "Grand Lotto 6/55", "GL55", "21:00"),
    Game("SL49", "Superlotto 6/49", "SL49", "21:00"),
    Game("ML45", "Megalotto 6/45", "ML45", "21:00"),
    Game("LOTTO42", "Lotto 6/42", "LOTTO42", "21:00"),
    Game("6DL", "6D Lotto", "6DL", "21:00"),
    Game("4DL", "4D Lotto", "4DL", "21:00"),
    Game("3DL-2PM", "3D Lotto 2PM", "3DL", "14:00"),
    Game("3DL-5PM", "3D Lotto 5PM", "3DL", "17:00"),
    Game("3DL-9PM", "3D Lotto 9PM", "3DL", "21:00"),
    Game("2DL-2PM", "2D Lotto 2PM", "2DL", "14:00"),
    Game("2DL-5PM", "2D Lotto 5PM", "2DL", "17:00"),
    Game("2DL-9PM", "2D Lotto 9PM", "2DL", "21:00"),
)

GAME_BY_CODE = {game.code: game for game in GAMES}
LOTTOMATIK_CODES = tuple(dict.fromkeys(game.lottomatik_code for game in GAMES))


def _key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.casefold())


ALIASES: dict[str, str] = {
    "ul58": "UL58",
    "658": "UL58",
    "ultralotto": "UL58",
    "gl55": "GL55",
    "655": "GL55",
    "grandlotto": "GL55",
    "sl49": "SL49",
    "649": "SL49",
    "superlotto": "SL49",
    "ml45": "ML45",
    "645": "ML45",
    "megalotto": "ML45",
    "lotto42": "LOTTO42",
    "642": "LOTTO42",
    "6dl": "6DL",
    "6d": "6DL",
    "4dl": "4DL",
    "4d": "4DL",
    "3dl": "3DL",
    "3d": "3DL",
    "2dl": "2DL",
    "2d": "2DL",
    "3dl2pm": "3DL-2PM",
    "3dlotto2pm": "3DL-2PM",
    "3dl5pm": "3DL-5PM",
    "3dlotto5pm": "3DL-5PM",
    "3dl9pm": "3DL-9PM",
    "3dlotto9pm": "3DL-9PM",
    "2dl2pm": "2DL-2PM",
    "2dlotto2pm": "2DL-2PM",
    "2dl5pm": "2DL-5PM",
    "2dlotto5pm": "2DL-5PM",
    "2dl9pm": "2DL-9PM",
    "2dlotto9pm": "2DL-9PM",
}

for _game in GAMES:
    ALIASES[_key(_game.code)] = _game.code
    ALIASES[_key(_game.name)] = _game.code


def normalize_game_filter(value: str | None) -> str | None:
    """Return a canonical game code, an aggregate 2DL/3DL code, or None."""
    if value is None or _key(value) in {"", "all", "0"}:
        return None
    normalized = ALIASES.get(_key(value))
    if normalized is None:
        choices = ", ".join(LOTTOMATIK_CODES)
        raise InvalidInputError(f"Unknown game {value!r}. Use one of: {choices}, or all.")
    return normalized


def game_from_lottomatik(code: str, draw_time: str | None) -> Game | None:
    normalized_code = code.upper()
    if normalized_code not in {"2DL", "3DL"}:
        return GAME_BY_CODE.get(normalized_code)

    time_prefix = (draw_time or "")[:5]
    suffix = {"14:00": "2PM", "17:00": "5PM", "21:00": "9PM"}.get(time_prefix)
    return GAME_BY_CODE.get(f"{normalized_code}-{suffix}") if suffix else None


def lottomatik_codes_for_filter(game_filter: str | None) -> tuple[str, ...]:
    if game_filter is None:
        return LOTTOMATIK_CODES
    if game_filter in {"2DL", "3DL"}:
        return (game_filter,)
    return (GAME_BY_CODE[game_filter].lottomatik_code,)


def matches_game_filter(game_code: str, game_filter: str | None) -> bool:
    if game_filter is None:
        return True
    if game_filter in {"2DL", "3DL"}:
        return game_code.startswith(f"{game_filter}-")
    return game_code == game_filter
