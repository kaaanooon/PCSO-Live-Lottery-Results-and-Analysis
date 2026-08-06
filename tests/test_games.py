import pytest

from lottery_picker.errors import InvalidInputError
from lottery_picker.games import normalize_game_filter


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("all", None),
        ("6/58", "UL58"),
        ("Grand Lotto 6/55", "GL55"),
        ("3D", "3DL"),
        ("3D Lotto 2PM", "3DL-2PM"),
    ],
)
def test_normalize_game_filter(value, expected):
    assert normalize_game_filter(value) == expected


def test_unknown_game_is_rejected():
    with pytest.raises(InvalidInputError):
        normalize_game_filter("not-a-game")
