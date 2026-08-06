from __future__ import annotations

import csv
import json
from datetime import date

from lottery_picker.analysis import (
    ANALYSIS_GAME_BY_CODE,
    AnalysisDraw,
    analyze_game,
    build_analysis,
    format_combination,
    load_analysis_draws,
    select_latest_draws,
)


def _draw(code: str, numbers: tuple[int, ...], day: int, draw_time: str = "21:00"):
    game_code = f"{code}-{draw_time.replace(':00', '').replace('14', '2PM').replace('17', '5PM').replace('21', '9PM')}" if code in {"2DL", "3DL"} else code
    return AnalysisDraw(
        logical_game_code=code,
        game_code=game_code,
        game=ANALYSIS_GAME_BY_CODE[code].name,
        numbers=numbers,
        draw_date=date(2026, 1, day),
        draw_time=draw_time,
        jackpot="0",
        winners=0,
    )


def test_combination_format_preserves_order_and_leading_zeroes():
    assert format_combination((0, 4, 6), ANALYSIS_GAME_BY_CODE["3DL"]) == "046"
    assert format_combination((8, 4), ANALYSIS_GAME_BY_CODE["2DL"]) == "08-04"
    assert format_combination((12, 1, 42, 5, 18, 2), ANALYSIS_GAME_BY_CODE["LOTTO42"]) == (
        "01-02-05-12-18-42"
    )


def test_ordered_analysis_reconciles_frequency_parity_and_positions():
    draws = (
        _draw("3DL", (0, 4, 6), 1),
        _draw("3DL", (5, 3, 3), 2),
        _draw("3DL", (9, 4, 3), 3),
    )
    result = analyze_game(draws, ANALYSIS_GAME_BY_CODE["3DL"], candidate_count=4, seed=7)

    assert sum(row["appearance_count"] for row in result["frequency"]) == 9
    assert sum(row["draw_count"] for row in result["parity_distribution"]) == 3
    for position in (1, 2, 3):
        assert sum(
            row["count"] for row in result["position_frequency"] if row["position"] == position
        ) == 3
    assert len(result["candidates"]) == 4
    assert all(len(row["combination"]) == 3 for row in result["candidates"])


def test_jackpot_candidates_are_sorted_unique_and_deterministic():
    draws = (
        _draw("LOTTO42", (1, 5, 10, 20, 30, 42), 1),
        _draw("LOTTO42", (2, 6, 11, 21, 31, 41), 2),
        _draw("LOTTO42", (3, 7, 12, 22, 32, 40), 3),
    )
    first = analyze_game(draws, ANALYSIS_GAME_BY_CODE["LOTTO42"], 6, 123)
    second = analyze_game(draws, ANALYSIS_GAME_BY_CODE["LOTTO42"], 6, 123)

    assert first["candidates"] == second["candidates"]
    assert first["summary"]["theoretical_outcomes"] == 5_245_786
    for row in first["candidates"]:
        values = [int(value) for value in row["numbers"]]
        assert values == sorted(values)
        assert len(values) == len(set(values)) == 6
        assert all(1 <= value <= 42 for value in values)


def test_4d_perm_counts_are_reported():
    draws = (
        _draw("4DL", (1, 2, 3, 4), 1),
        _draw("4DL", (1, 1, 2, 3), 2),
        _draw("4DL", (1, 1, 2, 2), 3),
        _draw("4DL", (1, 1, 1, 2), 4),
    )
    result = analyze_game(draws, ANALYSIS_GAME_BY_CODE["4DL"], candidate_count=0)
    counts = {
        row["rambolito_key"]: row["straight_permutations"]
        for row in result["rambolito_frequency"]
    }
    assert counts == {"1234": 24, "1123": 12, "1122": 6, "1112": 4}


def test_load_draws_filters_dates_inclusively(tmp_path):
    path = tmp_path / "draws.csv"
    headers = [
        "game_code",
        "game",
        "numbers",
        "combination",
        "draw_date",
        "draw_time",
        "jackpot",
        "winners",
    ]
    rows = [
        ["2DL-9PM", "2D Lotto 9PM", json.dumps(["08", "04"]), "08-04", "2026-01-01", "21:00", "0", "0"],
        ["2DL-9PM", "2D Lotto 9PM", json.dumps(["31", "31"]), "31-31", "2026-01-02", "21:00", "0", "0"],
        ["2DL-9PM", "2D Lotto 9PM", json.dumps(["01", "30"]), "01-30", "2026-01-03", "21:00", "0", "0"],
    ]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(headers)
        writer.writerows(rows)

    loaded = load_analysis_draws(path, date(2026, 1, 2), date(2026, 1, 2))
    assert len(loaded) == 1
    assert loaded[0].numbers == (31, 31)


def test_build_analysis_reports_nine_logical_games():
    draws = tuple(
        _draw(rule.code, tuple(rule.domain[: rule.pick_count]), index + 1)
        for index, rule in enumerate(ANALYSIS_GAME_BY_CODE.values())
    )
    analysis = build_analysis(draws, candidate_count=0)
    assert len(analysis["games"]) == 9
    assert analysis["metadata"]["draw_count"] == 9


def test_select_latest_draws_limits_each_logical_game_independently():
    draws = (
        _draw("2DL", (1, 2), 1),
        _draw("3DL", (1, 2, 3), 1),
        _draw("2DL", (3, 4), 2),
        _draw("3DL", (4, 5, 6), 2),
        _draw("LOTTO42", (1, 2, 3, 4, 5, 6), 2),
        _draw("2DL", (5, 6), 3),
    )

    selected = select_latest_draws(draws, latest_per_game=2)
    dates_by_game = {
        code: [draw.draw_date.day for draw in selected if draw.logical_game_code == code]
        for code in {draw.logical_game_code for draw in selected}
    }

    assert dates_by_game == {
        "2DL": [2, 3],
        "3DL": [1, 2],
        "LOTTO42": [2],
    }


def test_rolling_frequency_covers_full_domain_and_unseen_gap_is_blank():
    draws = (
        _draw("3DL", (0, 1, 2), 1),
        _draw("3DL", (2, 3, 4), 2),
        _draw("3DL", (4, 5, 6), 3),
        _draw("3DL", (6, 7, 8), 4),
    )
    result = analyze_game(
        draws,
        ANALYSIS_GAME_BY_CODE["3DL"],
        candidate_count=0,
        rolling_window=3,
    )

    rolling = result["rolling_frequency"]
    assert len(rolling) == 2 * ANALYSIS_GAME_BY_CODE["3DL"].domain_size
    assert {row["draw_index"] for row in rolling} == {3, 4}
    for draw_index in (3, 4):
        window = [row for row in rolling if row["draw_index"] == draw_index]
        assert len(window) == 10
        assert sum(row["count"] for row in window) == 9

    unseen = next(row for row in result["frequency"] if row["numeric_value"] == 9)
    assert unseen["seen_in_selected_sample"] is False
    assert unseen["draws_since_last"] == ""
    assert unseen["draws_since_last_in_sample"] == ""


def test_ordered_triples_are_adjacent_and_pair_support_never_exceeds_100_percent():
    draws = (
        _draw("4DL", (0, 0, 0, 0), 1),
        _draw("4DL", (0, 0, 0, 0), 2),
    )
    result = analyze_game(draws, ANALYSIS_GAME_BY_CODE["4DL"], candidate_count=0)

    repeated_transition = next(
        row
        for row in result["pair_or_transition_frequency"]
        if row["pair_or_transition"] == "0>0"
    )
    assert repeated_transition["occurrence_count"] == 6
    assert repeated_transition["draw_support_count"] == 2
    assert repeated_transition["draw_support_pct"] == 100.0
    assert all(
        row["draw_support_pct"] <= 100
        for row in result["pair_or_transition_frequency"]
    )

    repeated_triple = result["triple_frequency"][0]
    assert repeated_triple["triple"] == "0>0>0"
    assert repeated_triple["occurrence_count"] == 4
    assert repeated_triple["draw_support_count"] == 2
    assert repeated_triple["draw_support_pct"] == 100.0


def test_unordered_triples_include_every_three_number_combination():
    draws = (
        _draw("LOTTO42", (1, 2, 3, 4, 5, 6), 1),
        _draw("LOTTO42", (1, 2, 3, 7, 8, 9), 2),
    )
    result = analyze_game(draws, ANALYSIS_GAME_BY_CODE["LOTTO42"], candidate_count=0)

    assert sum(row["occurrence_count"] for row in result["triple_frequency"]) == 40
    shared = next(row for row in result["triple_frequency"] if row["triple"] == "01-02-03")
    assert shared["occurrence_count"] == 2
    assert shared["draw_support_count"] == 2
    assert shared["draw_support_pct"] == 100.0
    assert any(row["triple"] == "01-04-06" for row in result["triple_frequency"])


def test_recommended_candidate_is_deterministic_valid_and_honestly_described():
    draws = (
        _draw("LOTTO42", (1, 5, 10, 20, 30, 42), 1),
        _draw("LOTTO42", (2, 6, 11, 21, 31, 41), 2),
        _draw("LOTTO42", (3, 7, 12, 22, 32, 40), 3),
    )
    first = analyze_game(draws, ANALYSIS_GAME_BY_CODE["LOTTO42"], candidate_count=0, seed=71)
    second = analyze_game(draws, ANALYSIS_GAME_BY_CODE["LOTTO42"], candidate_count=0, seed=71)

    assert first["recommended_candidate"] == second["recommended_candidate"]
    values = [int(value) for value in first["recommended_candidate"]["numbers"]]
    assert values == sorted(values)
    assert len(values) == len(set(values)) == 6
    assert all(1 <= value <= 42 for value in values)
    assert "not more likely" in first["recommended_candidate"]["probability_warning"].lower()
    assert any("not more likely" in paragraph.lower() for paragraph in first["narratives"])
