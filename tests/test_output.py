from datetime import date
from decimal import Decimal

import pytest

from lottery_picker.errors import OutputError
from lottery_picker.models import DrawResult, FetchOutcome
from lottery_picker.output import render_output, write_output


def _outcome():
    result = DrawResult(
        game_code="2DL-9PM",
        game="2D Lotto 9PM",
        numbers=("01", "02"),
        draw_date=date(2026, 8, 5),
        draw_time="21:00",
        jackpot=Decimal("4000.00"),
        winners=86,
    )
    return FetchOutcome((result,))


def test_json_output_preserves_number_strings():
    rendered = render_output(_outcome(), "json")
    assert '"numbers": [' in rendered
    assert '"01"' in rendered
    assert '"jackpot": "4000.00"' in rendered


def test_csv_output_contains_combination():
    assert "01-02" in render_output(_outcome(), "csv")


def test_csv_output_has_only_requested_headers():
    header = render_output(_outcome(), "csv").splitlines()[0]
    assert header == (
        "game_code,game,numbers,combination,draw_date,draw_time,jackpot,winners"
    )


def test_json_output_omits_provider_metadata():
    rendered = render_output(_outcome(), "json")
    assert '"source"' not in rendered
    assert '"source_id"' not in rendered


def test_write_output_creates_parent_directories(tmp_path):
    destination = tmp_path / "nested" / "results.json"
    write_output("{}", destination)
    assert destination.read_text(encoding="utf-8") == "{}"


def test_write_output_reports_filesystem_error(tmp_path):
    with pytest.raises(OutputError, match="Could not write"):
        write_output("data", tmp_path)
