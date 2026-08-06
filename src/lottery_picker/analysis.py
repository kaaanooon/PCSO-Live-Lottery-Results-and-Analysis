from __future__ import annotations

import csv
import hashlib
import itertools
import json
import math
import random
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path
from statistics import mean, median
from typing import Any, Iterable, Sequence


PCSO_GAME_MANUAL_URL = (
    "https://lottomatik-backend.api-lottomatik.workers.dev/download/Game%20Manual.pdf"
)
LOTTOMATIK_DOWNLOADS_URL = "https://lottomatik.pcso.gov.ph/downloads"
LOTTOMATIK_RESULTS_URL = "https://lottomatik.pcso.gov.ph/lotto-results"


@dataclass(frozen=True, slots=True)
class AnalysisGame:
    code: str
    name: str
    pick_count: int
    minimum: int
    maximum: int
    ordered: bool
    repeats_allowed: bool
    display_width: int
    rambolito_name: str | None = None

    @property
    def domain(self) -> tuple[int, ...]:
        return tuple(range(self.minimum, self.maximum + 1))

    @property
    def domain_size(self) -> int:
        return self.maximum - self.minimum + 1

    @property
    def theoretical_outcomes(self) -> int:
        if self.ordered:
            return self.domain_size**self.pick_count
        return math.comb(self.domain_size, self.pick_count)

    @property
    def rule_text(self) -> str:
        range_text = f"{self.minimum}-{self.maximum}"
        if self.ordered:
            repeat_text = "repeats allowed" if self.repeats_allowed else "no repeats"
            return (
                f"Choose {self.pick_count} positional values from {range_text}; "
                f"exact order; {repeat_text}."
            )
        return (
            f"Choose {self.pick_count} unique numbers from {range_text}; "
            "ticket order does not matter."
        )


ANALYSIS_GAMES: tuple[AnalysisGame, ...] = (
    AnalysisGame("2DL", "2D Lotto", 2, 1, 31, True, True, 2, "Rambolito"),
    AnalysisGame("3DL", "3D Lotto", 3, 0, 9, True, True, 1, "Rambolito"),
    AnalysisGame("4DL", "4D Lotto", 4, 0, 9, True, True, 1, "PERM"),
    AnalysisGame("6DL", "6D Lotto", 6, 0, 9, True, True, 1),
    AnalysisGame("LOTTO42", "Lotto 6/42", 6, 1, 42, False, False, 2),
    AnalysisGame("ML45", "Mega Lotto 6/45", 6, 1, 45, False, False, 2),
    AnalysisGame("SL49", "Super Lotto 6/49", 6, 1, 49, False, False, 2),
    AnalysisGame("GL55", "Grand Lotto 6/55", 6, 1, 55, False, False, 2),
    AnalysisGame("UL58", "Ultra Lotto 6/58", 6, 1, 58, False, False, 2),
)
ANALYSIS_GAME_BY_CODE = {game.code: game for game in ANALYSIS_GAMES}


@dataclass(frozen=True, slots=True)
class AnalysisDraw:
    logical_game_code: str
    game_code: str
    game: str
    numbers: tuple[int, ...]
    draw_date: date
    draw_time: str
    jackpot: str
    winners: int

    @property
    def identity(self) -> tuple[str, date, str]:
        return (self.game_code, self.draw_date, self.draw_time)


def _logical_game_code(game_code: str) -> str:
    if game_code.startswith("2DL-"):
        return "2DL"
    if game_code.startswith("3DL-"):
        return "3DL"
    return game_code


def _parse_numbers(row: dict[str, str], row_number: int) -> tuple[int, ...]:
    raw = row.get("numbers", "")
    try:
        values = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Row {row_number}: invalid numbers JSON: {raw!r}.") from exc
    if not isinstance(values, list) or not values:
        raise ValueError(f"Row {row_number}: numbers must be a non-empty JSON list.")
    try:
        return tuple(int(value) for value in values)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Row {row_number}: every number must be an integer value.") from exc


def _parse_money(value: str) -> float | None:
    normalized = value.strip().replace(",", "").replace("₱", "")
    if normalized.upper().startswith("PHP"):
        normalized = normalized[3:].strip()
    if not normalized:
        return None
    return float(normalized)


def _validate_draw(draw: AnalysisDraw, rule: AnalysisGame, row_number: int) -> None:
    if len(draw.numbers) != rule.pick_count:
        raise ValueError(
            f"Row {row_number}: {draw.game_code} has {len(draw.numbers)} values; "
            f"expected {rule.pick_count}."
        )
    outside = [number for number in draw.numbers if number not in rule.domain]
    if outside:
        raise ValueError(
            f"Row {row_number}: {draw.game_code} has out-of-range values {outside}; "
            f"expected {rule.minimum}-{rule.maximum}."
        )
    if not rule.repeats_allowed and len(set(draw.numbers)) != len(draw.numbers):
        raise ValueError(f"Row {row_number}: {draw.game_code} contains repeated numbers.")


def load_analysis_draws(
    path: Path,
    start_date: date | None = None,
    end_date: date | None = None,
) -> tuple[AnalysisDraw, ...]:
    """Load, validate, date-filter, and chronologically sort the eight-column CSV."""
    if start_date and end_date and start_date > end_date:
        raise ValueError("Start date must be on or before end date.")

    draws: list[AnalysisDraw] = []
    identities: set[tuple[str, date, str]] = set()
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        required = {
            "game_code",
            "game",
            "numbers",
            "combination",
            "draw_date",
            "draw_time",
            "jackpot",
            "winners",
        }
        missing = required.difference(reader.fieldnames or ())
        if missing:
            raise ValueError(f"Input CSV is missing columns: {', '.join(sorted(missing))}.")

        for row_number, row in enumerate(reader, start=2):
            try:
                draw_date = date.fromisoformat(row["draw_date"])
                winners = int(row["winners"] or 0)
            except (TypeError, ValueError) as exc:
                raise ValueError(f"Row {row_number}: invalid date or winners value.") from exc
            if winners < 0:
                raise ValueError(f"Row {row_number}: winners cannot be negative.")
            try:
                jackpot_value = _parse_money(row["jackpot"] or "")
            except ValueError as exc:
                raise ValueError(f"Row {row_number}: invalid jackpot value.") from exc
            if jackpot_value is not None and jackpot_value < 0:
                raise ValueError(f"Row {row_number}: jackpot cannot be negative.")
            if start_date and draw_date < start_date:
                continue
            if end_date and draw_date > end_date:
                continue

            logical_code = _logical_game_code(row["game_code"])
            rule = ANALYSIS_GAME_BY_CODE.get(logical_code)
            if rule is None:
                raise ValueError(f"Row {row_number}: unsupported game code {row['game_code']!r}.")
            draw = AnalysisDraw(
                logical_game_code=logical_code,
                game_code=row["game_code"],
                game=row["game"],
                numbers=_parse_numbers(row, row_number),
                draw_date=draw_date,
                draw_time=(row["draw_time"] or "")[:5],
                jackpot=row["jackpot"] or "0",
                winners=winners,
            )
            _validate_draw(draw, rule, row_number)
            if draw.identity in identities:
                raise ValueError(f"Row {row_number}: duplicate draw identity {draw.identity!r}.")
            identities.add(draw.identity)
            draws.append(draw)

    draws.sort(key=lambda item: (item.draw_date, item.draw_time, item.game_code))
    return tuple(draws)


def select_latest_draws(
    draws: Sequence[AnalysisDraw], latest_per_game: int
) -> tuple[AnalysisDraw, ...]:
    """Return the latest N draws independently for each of the nine logical games."""
    if latest_per_game <= 0:
        raise ValueError("Latest draw count must be greater than zero.")
    grouped: dict[str, list[AnalysisDraw]] = defaultdict(list)
    for draw in draws:
        grouped[draw.logical_game_code].append(draw)
    selected = [
        draw
        for rule in ANALYSIS_GAMES
        for draw in grouped.get(rule.code, [])[-latest_per_game:]
    ]
    selected.sort(key=lambda item: (item.draw_date, item.draw_time, item.game_code))
    return tuple(selected)


def _format_number(number: int, rule: AnalysisGame) -> str:
    return f"{number:0{rule.display_width}d}"


def format_combination(numbers: Sequence[int], rule: AnalysisGame) -> str:
    values = tuple(numbers) if rule.ordered else tuple(sorted(numbers))
    separator = "-" if rule.code == "2DL" or not rule.ordered else ""
    return separator.join(_format_number(number, rule) for number in values)


def _percentile(values: Sequence[int], fraction: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    if len(ordered) == 1:
        return float(ordered[0])
    position = (len(ordered) - 1) * fraction
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return float(ordered[lower])
    weight = position - lower
    return ordered[lower] * (1 - weight) + ordered[upper] * weight


def _theoretical_count_probability(rule: AnalysisGame, even_count: int) -> float:
    even_values = sum(number % 2 == 0 for number in rule.domain)
    odd_values = rule.domain_size - even_values
    if rule.ordered:
        probability_even = even_values / rule.domain_size
        return (
            math.comb(rule.pick_count, even_count)
            * probability_even**even_count
            * (1 - probability_even) ** (rule.pick_count - even_count)
        )
    if even_count > even_values or rule.pick_count - even_count > odd_values:
        return 0.0
    return (
        math.comb(even_values, even_count)
        * math.comb(odd_values, rule.pick_count - even_count)
        / math.comb(rule.domain_size, rule.pick_count)
    )


def _permutation_count(numbers: Sequence[int]) -> int:
    result = math.factorial(len(numbers))
    for count in Counter(numbers).values():
        result //= math.factorial(count)
    return result


def _weighted_choice(rng: random.Random, values: Sequence[int], weights: Sequence[float]) -> int:
    return rng.choices(values, weights=weights, k=1)[0]


def _fnv1a_32(value: str) -> int:
    """Match the small, portable FNV-1a seed used by the browser report."""
    result = 2166136261
    for character in value:
        result ^= ord(character)
        result = (result * 16777619) & 0xFFFFFFFF
    return result


class _Mulberry32:
    """Tiny deterministic PRNG shared conceptually with the static HTML report."""

    def __init__(self, seed: int) -> None:
        self.state = seed & 0xFFFFFFFF

    @staticmethod
    def _imul(left: int, right: int) -> int:
        return ((left & 0xFFFFFFFF) * (right & 0xFFFFFFFF)) & 0xFFFFFFFF

    def random(self) -> float:
        self.state = (self.state + 0x6D2B79F5) & 0xFFFFFFFF
        value = self._imul(self.state ^ (self.state >> 15), self.state | 1)
        value ^= (
            value + self._imul(value ^ (value >> 7), value | 61)
        ) & 0xFFFFFFFF
        value &= 0xFFFFFFFF
        return ((value ^ (value >> 14)) & 0xFFFFFFFF) / 4294967296

    def choices(
        self, values: Sequence[int], *, weights: Sequence[float], k: int
    ) -> list[int]:
        if k != 1:
            raise ValueError("Mulberry32 weighted choice supports one value at a time.")
        target = self.random() * sum(weights)
        running = 0.0
        for value, weight in zip(values, weights):
            running += weight
            if target <= running:
                return [value]
        return [values[-1]]


def _weighted_sample_without_replacement(
    rng: random.Random,
    values: Sequence[int],
    weights: Sequence[float],
    count: int,
) -> tuple[int, ...]:
    remaining_values = list(values)
    remaining_weights = list(weights)
    selected: list[int] = []
    for _ in range(count):
        selected_value = _weighted_choice(rng, remaining_values, remaining_weights)
        index = remaining_values.index(selected_value)
        selected.append(remaining_values.pop(index))
        remaining_weights.pop(index)
    return tuple(selected)


def _rng_for_draw_sample(
    seed: int, game_code: str, draws: Sequence[AnalysisDraw], purpose: str
) -> random.Random:
    material = "|".join(
        f"{draw.game_code}:{draw.draw_date.isoformat()}:{draw.draw_time}:"
        f"{','.join(str(number) for number in draw.numbers)}"
        for draw in draws
    )
    digest = hashlib.sha256(f"{seed}:{game_code}:{purpose}:{material}".encode()).digest()
    return random.Random(int.from_bytes(digest[:16], "big"))


def _candidate_score_context(draws: Sequence[AnalysisDraw], rule: AnalysisGame) -> dict[str, Any]:
    draw_count = len(draws)
    overall = Counter(number for draw in draws for number in draw.numbers)
    position = [Counter(draw.numbers[index] for draw in draws) for index in range(rule.pick_count)]
    parity = Counter(sum(number % 2 == 0 for number in draw.numbers) for draw in draws)
    midpoint = (rule.minimum + rule.maximum) // 2
    low = Counter(sum(number <= midpoint for number in draw.numbers) for draw in draws)
    unique = Counter(len(set(draw.numbers)) for draw in draws)
    sums = [sum(draw.numbers) for draw in draws]
    history_blend = min(0.35, draw_count / (draw_count + 20))
    fair_sum_mean = rule.pick_count * (rule.minimum + rule.maximum) / 2
    fair_sum_variance = rule.pick_count * (rule.domain_size**2 - 1) / 12
    if not rule.ordered and rule.domain_size > 1:
        fair_sum_variance *= (rule.domain_size - rule.pick_count) / (rule.domain_size - 1)
    sample_sum_mean = mean(sums) if sums else fair_sum_mean
    return {
        "draw_count": draw_count,
        "overall": overall,
        "position": position,
        "parity": parity,
        "low": low,
        "unique": unique,
        "history_blend": history_blend,
        "sum_mean": (1 - history_blend) * fair_sum_mean + history_blend * sample_sum_mean,
        "sum_std": math.sqrt(fair_sum_variance),
    }


def _profile_score(numbers: Sequence[int], rule: AnalysisGame, context: dict[str, Any]) -> float:
    draw_count = context["draw_count"]
    domain_size = rule.domain_size
    if rule.ordered:
        relative_rates = [
            ((context["position"][index][number] + 1) / (draw_count + domain_size))
            / (1 / domain_size)
            for index, number in enumerate(numbers)
        ]
    else:
        total_slots = draw_count * rule.pick_count
        relative_rates = [
            ((context["overall"][number] + 1) / (total_slots + domain_size))
            / (1 / domain_size)
            for number in numbers
        ]
    frequency_fit = mean(min(2.0, rate) / 2.0 for rate in relative_rates)

    even_count = sum(number % 2 == 0 for number in numbers)
    midpoint = (rule.minimum + rule.maximum) // 2
    low_count = sum(number <= midpoint for number in numbers)
    parity_peak = max(context["parity"].values(), default=1)
    low_peak = max(context["low"].values(), default=1)
    parity_fit = context["parity"][even_count] / parity_peak
    low_fit = context["low"][low_count] / low_peak

    sum_std = context["sum_std"]
    if sum_std:
        sum_z = (sum(numbers) - context["sum_mean"]) / sum_std
        sum_fit = math.exp(-0.5 * sum_z * sum_z)
    else:
        sum_fit = 1.0

    if rule.ordered:
        unique_peak = max(context["unique"].values(), default=1)
        unique_fit = context["unique"][len(set(numbers))] / unique_peak
    else:
        unique_fit = 1.0
    score = (
        0.35 * frequency_fit
        + 0.20 * parity_fit
        + 0.15 * low_fit
        + 0.20 * sum_fit
        + 0.10 * unique_fit
    )
    return round(score * 100, 2)


def _generate_one_candidate(
    rng: random.Random,
    rule: AnalysisGame,
    context: dict[str, Any],
    strategy: str,
) -> tuple[int, ...]:
    values = rule.domain
    uniform_weights = [1.0] * rule.domain_size
    blend = context["history_blend"]
    draw_count = context["draw_count"]
    if rule.ordered:
        selected: list[int] = []
        for position_index in range(rule.pick_count):
            if strategy == "Uniform baseline":
                weights = uniform_weights
            else:
                counter = context["position"][position_index]
                smoothed = [
                    (counter[number] + 1) / (draw_count + rule.domain_size)
                    for number in values
                ]
                weights = [
                    (1 - blend) * (1 / rule.domain_size) + blend * probability
                    for probability in smoothed
                ]
            selected.append(_weighted_choice(rng, values, weights))
        return tuple(selected)

    if strategy == "Uniform baseline":
        weights = uniform_weights
    else:
        total_slots = draw_count * rule.pick_count
        smoothed = [
            (context["overall"][number] + 1) / (total_slots + rule.domain_size)
            for number in values
        ]
        weights = [
            (1 - blend) * (1 / rule.domain_size) + blend * probability
            for probability in smoothed
        ]
    return tuple(sorted(_weighted_sample_without_replacement(rng, values, weights, rule.pick_count)))


def _candidate_row(
    numbers: Sequence[int],
    rule: AnalysisGame,
    context: dict[str, Any],
    history: Counter[tuple[int, ...]],
    strategy: str,
    rank: int = 1,
) -> dict[str, Any]:
    candidate = tuple(numbers)
    canonical = tuple(sorted(candidate))
    even_count = sum(number % 2 == 0 for number in candidate)
    midpoint = (rule.minimum + rule.maximum) // 2
    return {
        "rank": rank,
        "strategy": strategy,
        "combination": format_combination(candidate, rule),
        "numbers": [_format_number(number, rule) for number in candidate],
        "even_count": even_count,
        "odd_count": rule.pick_count - even_count,
        "low_count": sum(number <= midpoint for number in candidate),
        "high_count": sum(number > midpoint for number in candidate),
        "sum": sum(candidate),
        "unique_values": len(set(candidate)),
        "historical_fit_score": _profile_score(candidate, rule, context),
        "seen_before_count": history[candidate if rule.ordered else canonical],
        "rambolito_key": format_combination(canonical, rule) if rule.rambolito_name else "",
        "straight_permutations": _permutation_count(candidate) if rule.rambolito_name else "",
        "theoretical_odds_1_in": rule.theoretical_outcomes,
        "odds_scope": "Straight play" if rule.rambolito_name else "Standard game",
        "note": "Historical fit is descriptive, not a win probability.",
    }


def _select_candidates(
    draws: Sequence[AnalysisDraw],
    rule: AnalysisGame,
    candidate_count: int,
    seed: int,
) -> list[dict[str, Any]]:
    if not draws or candidate_count <= 0:
        return []
    rng = _rng_for_draw_sample(seed, rule.code, draws, "candidate-list")
    context = _candidate_score_context(draws, rule)
    history = Counter(
        tuple(draw.numbers) if rule.ordered else tuple(sorted(draw.numbers)) for draw in draws
    )
    strategies = ("Uniform baseline", "Smoothed frequency", "Historical profile")
    allocations = Counter(strategies[index % len(strategies)] for index in range(candidate_count))
    chosen: list[tuple[str, tuple[int, ...], float]] = []
    used: set[tuple[int, ...]] = set()

    for strategy in strategies:
        needed = allocations[strategy]
        if needed == 0:
            continue
        pool_size = max(500, needed * 200)
        pool: list[tuple[float, tuple[int, ...]]] = []
        for _ in range(pool_size):
            numbers = _generate_one_candidate(rng, rule, context, strategy)
            score = _profile_score(numbers, rule, context)
            pool.append((score, numbers))
        if strategy == "Uniform baseline":
            rng.shuffle(pool)
        else:
            pool.sort(key=lambda item: (-item[0], item[1]))

        for score, numbers in pool:
            if numbers in used:
                continue
            if not rule.ordered and any(
                len(set(numbers).intersection(previous_numbers)) > 4
                for _, previous_numbers, _ in chosen
            ):
                continue
            used.add(numbers)
            chosen.append((strategy, numbers, score))
            if sum(item[0] == strategy for item in chosen) >= needed:
                break

    rows: list[dict[str, Any]] = []
    for rank, (strategy, numbers, _score) in enumerate(chosen, start=1):
        rows.append(_candidate_row(numbers, rule, context, history, strategy, rank))
    return rows


def _recommended_profile_candidate(
    draws: Sequence[AnalysisDraw], rule: AnalysisGame, seed: int
) -> dict[str, Any]:
    """Return the highest historical-fit sample from a deterministic candidate pool."""
    if not draws:
        return {}
    signature = "|".join(
        f"{draw.game_code}:{draw.draw_date.isoformat()}:{draw.draw_time}:"
        f"{','.join(str(number) for number in draw.numbers)}"
        for draw in draws
    )
    rng = _Mulberry32(_fnv1a_32(f"{seed}:{rule.code}:0:{signature}"))
    context = _candidate_score_context(draws, rule)
    history = Counter(
        tuple(draw.numbers) if rule.ordered else tuple(sorted(draw.numbers)) for draw in draws
    )
    pool = {
        _generate_one_candidate(rng, rule, context, "Historical profile") for _ in range(4_000)
    }
    best = min(
        pool,
        key=lambda numbers: (
            -_profile_score(numbers, rule, context),
            "|".join(str(number) for number in numbers),
        ),
    )
    row = _candidate_row(best, rule, context, history, "Highest historical profile")
    row["method"] = (
        "Selected from 4,000 deterministic samples using smoothed number/position frequency, "
        "the most common parity and low/high shapes, draw-sum centrality, and repetition shape."
    )
    row["probability_warning"] = (
        "This is not more likely in a fair draw; the score measures similarity to the selected "
        "historical sample only."
    )
    return row


def analyze_game(
    draws: Sequence[AnalysisDraw],
    rule: AnalysisGame,
    candidate_count: int = 10,
    seed: int = 20260806,
    rolling_window: int = 5,
) -> dict[str, Any]:
    if rolling_window <= 0:
        raise ValueError("Rolling window must be greater than zero.")
    selected = tuple(draw for draw in draws if draw.logical_game_code == rule.code)
    if not selected:
        return {
            "rule": asdict(rule),
            "summary": {"draw_count": 0},
            "frequency": [],
            "position_frequency": [],
            "parity_distribution": [],
            "parity_signatures": [],
            "draw_time_breakdown": [],
            "draw_features": [],
            "scatter": [],
            "pair_or_transition_frequency": [],
            "triple_frequency": [],
            "rolling_frequency": [],
            "sum_distribution": [],
            "low_high_distribution": [],
            "consecutive_distribution": [],
            "jackpot_statistics": {},
            "winner_statistics": {},
            "rambolito_frequency": [],
            "candidates": [],
            "recommended_candidate": {},
            "narratives": [],
        }

    draw_count = len(selected)
    total_slots = draw_count * rule.pick_count
    occurrence_count = Counter(number for draw in selected for number in draw.numbers)
    draw_hit_indices: dict[int, list[int]] = defaultdict(list)
    last_seen_date: dict[int, date] = {}
    for draw_index, draw in enumerate(selected):
        for number in set(draw.numbers):
            draw_hit_indices[number].append(draw_index)
            last_seen_date[number] = draw.draw_date

    frequency: list[dict[str, Any]] = []
    expected_count = total_slots / rule.domain_size
    for number in rule.domain:
        indices = draw_hit_indices[number]
        gaps = [right - left - 1 for left, right in zip(indices, indices[1:])]
        count = occurrence_count[number]
        if rule.ordered:
            variance = total_slots * (1 / rule.domain_size) * (1 - 1 / rule.domain_size)
        else:
            probability = rule.pick_count / rule.domain_size
            variance = draw_count * probability * (1 - probability)
        z_score = (count - expected_count) / math.sqrt(variance) if variance else 0.0
        frequency.append(
            {
                "number": _format_number(number, rule),
                "numeric_value": number,
                "appearance_count": count,
                "appearance_share_pct": round(count / total_slots * 100, 4),
                "draw_hit_count": len(indices),
                "draw_hit_rate_pct": round(len(indices) / draw_count * 100, 4),
                "expected_count": round(expected_count, 3),
                "difference_from_expected": round(count - expected_count, 3),
                "z_score": round(z_score, 3),
                "seen_in_selected_sample": bool(indices),
                "draws_since_last": draw_count - indices[-1] - 1 if indices else "",
                "draws_since_last_in_sample": draw_count - indices[-1] - 1 if indices else "",
                "mean_gap_draws": round(mean(gaps), 3) if gaps else "",
                "median_gap_draws": round(median(gaps), 3) if gaps else "",
                "maximum_gap_draws": max(gaps) if gaps else "",
                "last_seen": last_seen_date[number].isoformat() if indices else "",
            }
        )
    ranked = sorted(frequency, key=lambda row: (-row["appearance_count"], row["numeric_value"]))
    rank_by_number = {row["numeric_value"]: rank for rank, row in enumerate(ranked, start=1)}
    counts = [row["appearance_count"] for row in frequency]
    maximum_frequency = max(counts)
    minimum_frequency = min(counts)
    for row in frequency:
        row["frequency_rank"] = rank_by_number[row["numeric_value"]]
        if maximum_frequency == minimum_frequency:
            row["temperature"] = "Tied"
        elif row["appearance_count"] == maximum_frequency:
            row["temperature"] = "Sample hot"
        elif row["appearance_count"] == minimum_frequency:
            row["temperature"] = "Sample cold"
        else:
            row["temperature"] = "Middle"

    position_frequency: list[dict[str, Any]] = []
    if rule.ordered:
        for position_index in range(rule.pick_count):
            counts = Counter(draw.numbers[position_index] for draw in selected)
            for number in rule.domain:
                count = counts[number]
                position_frequency.append(
                    {
                        "position": position_index + 1,
                        "number": _format_number(number, rule),
                        "numeric_value": number,
                        "count": count,
                        "rate_pct": round(count / draw_count * 100, 4),
                        "expected_count": round(draw_count / rule.domain_size, 3),
                    }
                )

    parity_counts = Counter(sum(number % 2 == 0 for number in draw.numbers) for draw in selected)
    parity_distribution = [
        {
            "pattern": f"{even_count}E-{rule.pick_count - even_count}O",
            "even_count": even_count,
            "odd_count": rule.pick_count - even_count,
            "draw_count": parity_counts[even_count],
            "observed_pct": round(parity_counts[even_count] / draw_count * 100, 4),
            "theoretical_pct": round(
                _theoretical_count_probability(rule, even_count) * 100, 4
            ),
        }
        for even_count in range(rule.pick_count + 1)
    ]
    parity_signatures: list[dict[str, Any]] = []
    if rule.ordered:
        signatures = Counter(
            "-".join("E" if number % 2 == 0 else "O" for number in draw.numbers)
            for draw in selected
        )
        parity_signatures = [
            {
                "signature": signature,
                "draw_count": count,
                "observed_pct": round(count / draw_count * 100, 4),
            }
            for signature, count in sorted(signatures.items(), key=lambda item: (-item[1], item[0]))
        ]

    time_counts = Counter(draw.draw_time for draw in selected)
    draw_time_breakdown = [
        {
            "draw_time": draw_time,
            "draw_count": count,
            "share_pct": round(count / draw_count * 100, 4),
        }
        for draw_time, count in sorted(time_counts.items())
    ]

    midpoint = (rule.minimum + rule.maximum) // 2
    draw_features: list[dict[str, Any]] = []
    scatter: list[dict[str, Any]] = []
    previous_numbers: tuple[int, ...] | None = None
    for draw_index, draw in enumerate(selected, start=1):
        values_for_features = tuple(draw.numbers) if rule.ordered else tuple(sorted(draw.numbers))
        even_count = sum(number % 2 == 0 for number in values_for_features)
        adjacent_consecutive = sum(
            abs(right - left) == 1
            for left, right in zip(values_for_features, values_for_features[1:])
        )
        current_values = set(values_for_features)
        if previous_numbers is None:
            shared_with_previous: int | str = ""
            shared_distinct_with_previous: int | str = ""
            exact_position_repeats: int | str = ""
        else:
            current_counter = Counter(values_for_features)
            previous_counter = Counter(previous_numbers)
            shared_with_previous = sum(
                min(current_counter[number], previous_counter[number])
                for number in current_counter.keys() | previous_counter.keys()
            )
            shared_distinct_with_previous = len(
                set(values_for_features).intersection(previous_numbers)
            )
            exact_position_repeats = (
                sum(left == right for left, right in zip(values_for_features, previous_numbers))
                if rule.ordered
                else ""
            )
        draw_features.append(
            {
                "draw_index": draw_index,
                "game_code": draw.game_code,
                "draw_date": draw.draw_date.isoformat(),
                "draw_time": draw.draw_time,
                "combination": format_combination(values_for_features, rule),
                "sum": sum(values_for_features),
                "mean": round(mean(values_for_features), 3),
                "minimum": min(values_for_features),
                "maximum": max(values_for_features),
                "span": max(values_for_features) - min(values_for_features),
                "even_count": even_count,
                "odd_count": rule.pick_count - even_count,
                "low_count": sum(number <= midpoint for number in values_for_features),
                "high_count": sum(number > midpoint for number in values_for_features),
                "unique_values": len(current_values),
                "adjacent_consecutive_pairs": adjacent_consecutive,
                "shared_values_with_previous_draw": shared_with_previous,
                "shared_distinct_values_with_previous_draw": shared_distinct_with_previous,
                "exact_position_repeats_with_previous_draw": exact_position_repeats,
            }
        )
        previous_numbers = values_for_features
        for position_index, number in enumerate(draw.numbers, start=1):
            scatter.append(
                {
                    "draw_index": draw_index,
                    "draw_date": draw.draw_date.isoformat(),
                    "draw_time": draw.draw_time,
                    "position": position_index,
                    "number": number,
                }
            )

    pair_or_transition: Counter[tuple[int, ...]] = Counter()
    pair_support: Counter[tuple[int, ...]] = Counter()
    for draw in selected:
        patterns = list(
            zip(draw.numbers, draw.numbers[1:])
            if rule.ordered
            else itertools.combinations(sorted(draw.numbers), 2)
        )
        pair_or_transition.update(patterns)
        pair_support.update(set(patterns))
    pair_or_transition_frequency = [
        {
            "pair_or_transition": ">".join(_format_number(number, rule) for number in pair)
            if rule.ordered
            else "-".join(_format_number(number, rule) for number in pair),
            "first": _format_number(pair[0], rule),
            "second": _format_number(pair[1], rule),
            "count": count,
            "occurrence_count": count,
            "draw_support_count": pair_support[pair],
            "draw_support_pct": round(pair_support[pair] / draw_count * 100, 4),
        }
        for pair, count in sorted(pair_or_transition.items(), key=lambda item: (-item[1], item[0]))
    ]

    triples: Counter[tuple[int, ...]] = Counter()
    triple_support: Counter[tuple[int, ...]] = Counter()
    if rule.pick_count >= 3:
        for draw in selected:
            patterns = list(
                (
                    tuple(draw.numbers[index : index + 3])
                    for index in range(rule.pick_count - 2)
                )
                if rule.ordered
                else itertools.combinations(sorted(draw.numbers), 3)
            )
            triples.update(patterns)
            triple_support.update(set(patterns))
    triple_frequency = [
        {
            "triple": ">".join(_format_number(number, rule) for number in triple)
            if rule.ordered
            else "-".join(_format_number(number, rule) for number in triple),
            "count": count,
            "occurrence_count": count,
            "draw_support_count": triple_support[triple],
            "draw_support_pct": round(triple_support[triple] / draw_count * 100, 4),
        }
        for triple, count in sorted(triples.items(), key=lambda item: (-item[1], item[0]))
    ]

    effective_rolling_window = max(1, min(rolling_window, draw_count))
    rolling_frequency: list[dict[str, Any]] = []
    rolling_end_indices = list(range(effective_rolling_window - 1, draw_count))
    for draw_index in rolling_end_indices:
        window_start = draw_index - effective_rolling_window + 1
        window_draws = selected[window_start : draw_index + 1]
        window_counts = Counter(number for draw in window_draws for number in draw.numbers)
        window_slots = len(window_draws) * rule.pick_count
        for number in rule.domain:
            rolling_frequency.append(
                {
                    "draw_index": draw_index + 1,
                    "draw_date": selected[draw_index].draw_date.isoformat(),
                    "draw_time": selected[draw_index].draw_time,
                    "window_size": len(window_draws),
                    "number": _format_number(number, rule),
                    "count": window_counts[number],
                    "appearance_share_pct": round(window_counts[number] / window_slots * 100, 4),
                }
            )

    sum_counts = Counter(row["sum"] for row in draw_features)
    sum_distribution = [
        {
            "draw_sum": draw_sum,
            "draw_count": count,
            "observed_pct": round(count / draw_count * 100, 4),
        }
        for draw_sum, count in sorted(sum_counts.items())
    ]

    rambolito_frequency: list[dict[str, Any]] = []
    if rule.rambolito_name:
        groups: dict[tuple[int, ...], list[AnalysisDraw]] = defaultdict(list)
        for draw in selected:
            groups[tuple(sorted(draw.numbers))].append(draw)
        rambolito_frequency = [
            {
                "rambolito_key": format_combination(key, rule),
                "straight_permutations": _permutation_count(key),
                "draw_count": len(group_draws),
                "first_seen": min(draw.draw_date for draw in group_draws).isoformat(),
                "last_seen": max(draw.draw_date for draw in group_draws).isoformat(),
            }
            for key, group_draws in sorted(
                groups.items(), key=lambda item: (-len(item[1]), item[0])
            )
        ]

    sums = [sum(draw.numbers) for draw in selected]
    even_occurrences = sum(number % 2 == 0 for draw in selected for number in draw.numbers)
    low_high_counts = Counter((row["low_count"], row["high_count"]) for row in draw_features)
    low_high_distribution = [
        {
            "pattern": f"{low_count}L-{high_count}H",
            "low_count": low_count,
            "high_count": high_count,
            "draw_count": count,
            "observed_pct": round(count / draw_count * 100, 4),
        }
        for (low_count, high_count), count in sorted(
            low_high_counts.items(), key=lambda item: (-item[1], item[0])
        )
    ]
    draws_with_consecutive = sum(
        row["adjacent_consecutive_pairs"] > 0 for row in draw_features
    )
    consecutive_distribution = [
        {
            "consecutive_pair_count": pair_count,
            "draw_count": count,
            "observed_pct": round(count / draw_count * 100, 4),
        }
        for pair_count, count in sorted(
            Counter(row["adjacent_consecutive_pairs"] for row in draw_features).items()
        )
    ]
    total_consecutive_pairs = sum(row["adjacent_consecutive_pairs"] for row in draw_features)
    comparison_rows = draw_features[1:]
    draws_repeating_previous = sum(
        int(row["shared_values_with_previous_draw"]) > 0 for row in comparison_rows
    )
    average_shared_previous = (
        mean(int(row["shared_values_with_previous_draw"]) for row in comparison_rows)
        if comparison_rows
        else 0.0
    )
    average_exact_position_repeats = (
        mean(int(row["exact_position_repeats_with_previous_draw"]) for row in comparison_rows)
        if comparison_rows and rule.ordered
        else 0.0
    )

    jackpot_values: list[float] = []
    for draw in selected:
        try:
            value = _parse_money(draw.jackpot)
        except ValueError:
            continue
        if value is not None and value > 0:
            jackpot_values.append(value)
    jackpot_statistics = {
        "available_draws": len(jackpot_values),
        "unavailable_or_zero_draws": draw_count - len(jackpot_values),
        "average": round(mean(jackpot_values), 2) if jackpot_values else "",
        "median": round(median(jackpot_values), 2) if jackpot_values else "",
        "minimum": round(min(jackpot_values), 2) if jackpot_values else "",
        "maximum": round(max(jackpot_values), 2) if jackpot_values else "",
        "latest_available": round(jackpot_values[-1], 2) if jackpot_values else "",
    }
    winner_values = [draw.winners for draw in selected]
    winner_statistics = {
        "reported_total": sum(winner_values),
        "reported_average_per_draw": round(mean(winner_values), 3),
        "draws_with_reported_winners": sum(value > 0 for value in winner_values),
        "maximum_reported_winners": max(winner_values, default=0),
        "zero_reported_draws": sum(value == 0 for value in winner_values),
    }

    candidates = _select_candidates(selected, rule, candidate_count, seed)
    recommended_candidate = _recommended_profile_candidate(selected, rule, seed)

    top_count = max(row["appearance_count"] for row in frequency)
    top_numbers = [row["number"] for row in frequency if row["appearance_count"] == top_count]
    minimum_count = min(row["appearance_count"] for row in frequency)
    cold_numbers = [row["number"] for row in frequency if row["appearance_count"] == minimum_count]
    parity_peak = max(row["draw_count"] for row in parity_distribution)
    modal_parities = [row for row in parity_distribution if row["draw_count"] == parity_peak]
    modal_parity = modal_parities[0]
    top_pair = pair_or_transition_frequency[0] if pair_or_transition_frequency else None
    top_triple = triple_frequency[0] if triple_frequency else None
    if top_pair and top_pair["occurrence_count"] > 1:
        pair_sentence = (
            f"The leading {'ordered transition' if rule.ordered else 'pair'} was "
            f"{top_pair['pair_or_transition']} with {top_pair['occurrence_count']} occurrences."
        )
    else:
        pair_sentence = "No pair or ordered transition repeated in this selected sample."
    if rule.pick_count < 3:
        triple_sentence = "Triple analysis does not apply to 2D Lotto."
    elif top_triple and top_triple["occurrence_count"] > 1:
        triple_sentence = (
            f"The leading {'adjacent ordered triple' if rule.ordered else 'unordered triple'} "
            f"was {top_triple['triple']} with {top_triple['occurrence_count']} occurrences."
        )
    else:
        triple_sentence = "No triple repeated in this selected sample."
    if maximum_frequency == minimum_frequency:
        frequency_sentence = (
            f"Every value in the game domain was tied at {maximum_frequency} "
            f"appearance{'s' if maximum_frequency != 1 else ''} in this sample."
        )
    else:
        frequency_sentence = (
            f"{', '.join(top_numbers[:4])}{' and others' if len(top_numbers) > 4 else ''} "
            f"appeared most often ({top_count} time{'s' if top_count != 1 else ''}). "
            f"The least-seen values appeared {minimum_count} "
            f"time{'s' if minimum_count != 1 else ''}: "
            f"{', '.join(cold_numbers[:6])}{' and others' if len(cold_numbers) > 6 else ''}."
        )
    if len(modal_parities) == 1:
        parity_sentence = (
            f"The most common even/odd shape was {modal_parity['even_count']} even and "
            f"{modal_parity['odd_count']} odd, occurring in {modal_parity['draw_count']} of "
            f"{draw_count} draws."
        )
    else:
        parity_sentence = (
            "The leading even/odd shapes were tied: "
            f"{', '.join(row['pattern'] for row in modal_parities)}, each occurring in "
            f"{parity_peak} of {draw_count} draws."
        )
    if comparison_rows:
        comparison_sentence = (
            f"{draws_with_consecutive} of {draw_count} draws contained at least one adjacent "
            f"consecutive pair. {draws_repeating_previous} of {len(comparison_rows)} comparable "
            "draws shared at least one value with the previous draw."
        )
    else:
        comparison_sentence = (
            f"{draws_with_consecutive} of {draw_count} draws contained at least one adjacent "
            "consecutive pair. At least two draws are needed for a previous-draw comparison."
        )
    narratives = [
        (
            f"This view uses {draw_count} observed draw{'s' if draw_count != 1 else ''} from "
            f"{selected[0].draw_date.isoformat()} through {selected[-1].draw_date.isoformat()}."
        ),
        frequency_sentence,
        parity_sentence,
        (
            f"Draw sums averaged {mean(sums):.1f}, with a low of {min(sums)} and a high of "
            f"{max(sums)} in this sample."
        ),
        comparison_sentence,
        (
            f"For this game, low means {rule.minimum}-{midpoint} and high means "
            f"{midpoint + 1}-{rule.maximum}."
        ),
        (
            f"The source reported {winner_statistics['reported_total']:,} winners across this "
            f"sample. Positive jackpot values were available for {len(jackpot_values)} of "
            f"{draw_count} draws; zero placeholders are treated as unavailable."
        ),
        f"{pair_sentence} {triple_sentence}",
        (
            f"The rolling-frequency view uses trailing windows of "
            f"{effective_rolling_window} draw{'s' if effective_rolling_window != 1 else ''}. "
            "Gaps are counted in selected logical-game draw records, not calendar days."
        ),
    ]
    if draw_count < 30:
        narratives.append(
            "This is a very small sample. Hot/cold labels, gaps, pairs, triples, and profile "
            "scores can change sharply when another draw is added."
        )
    narratives.append(
        "The recommended combination is the closest historical-profile fit found in a fixed "
        "sample pool. It is not more likely than any other valid combination in a fair draw."
    )

    summary = {
        "game_code": rule.code,
        "game": rule.name,
        "rule": rule.rule_text,
        "order_requirement": "Exact order" if rule.ordered else "Any order",
        "rambolito_or_perm": rule.rambolito_name or "Not listed",
        "selected_start_date": min(draw.draw_date for draw in selected).isoformat(),
        "selected_end_date": max(draw.draw_date for draw in selected).isoformat(),
        "draw_count": draw_count,
        "number_observations": total_slots,
        "even_occurrences": even_occurrences,
        "odd_occurrences": total_slots - even_occurrences,
        "even_occurrence_pct": round(even_occurrences / total_slots * 100, 4),
        "odd_occurrence_pct": round((total_slots - even_occurrences) / total_slots * 100, 4),
        "average_draw_sum": round(mean(sums), 3),
        "median_draw_sum": round(median(sums), 3),
        "draw_sum_q1": round(_percentile(sums, 0.25), 3),
        "draw_sum_q3": round(_percentile(sums, 0.75), 3),
        "draws_with_consecutive": draws_with_consecutive,
        "draws_with_consecutive_pct": round(draws_with_consecutive / draw_count * 100, 4),
        "total_consecutive_pairs": total_consecutive_pairs,
        "average_consecutive_pairs": round(total_consecutive_pairs / draw_count, 3),
        "maximum_consecutive_pairs": max(
            row["adjacent_consecutive_pairs"] for row in draw_features
        ),
        "draws_repeating_previous": draws_repeating_previous,
        "previous_draw_comparisons": len(comparison_rows),
        "draws_repeating_previous_pct": round(
            draws_repeating_previous / len(comparison_rows) * 100, 4
        )
        if comparison_rows
        else 0.0,
        "average_shared_values_with_previous": round(average_shared_previous, 3),
        "average_exact_position_repeats_with_previous": round(
            average_exact_position_repeats, 3
        ),
        "rolling_window": effective_rolling_window,
        "theoretical_outcomes": rule.theoretical_outcomes,
        "theoretical_odds": f"1 in {rule.theoretical_outcomes:,}",
        "candidate_seed": seed,
        "candidate_count": candidate_count,
    }
    return {
        "rule": asdict(rule),
        "summary": summary,
        "frequency": frequency,
        "position_frequency": position_frequency,
        "parity_distribution": parity_distribution,
        "parity_signatures": parity_signatures,
        "draw_time_breakdown": draw_time_breakdown,
        "draw_features": draw_features,
        "scatter": scatter,
        "pair_or_transition_frequency": pair_or_transition_frequency,
        "triple_frequency": triple_frequency,
        "rolling_frequency": rolling_frequency,
        "sum_distribution": sum_distribution,
        "low_high_distribution": low_high_distribution,
        "consecutive_distribution": consecutive_distribution,
        "jackpot_statistics": jackpot_statistics,
        "winner_statistics": winner_statistics,
        "rambolito_frequency": rambolito_frequency,
        "candidates": candidates,
        "recommended_candidate": recommended_candidate,
        "narratives": narratives,
    }


def build_analysis(
    draws: Sequence[AnalysisDraw],
    candidate_count: int = 10,
    seed: int = 20260806,
    requested_start_date: date | None = None,
    requested_end_date: date | None = None,
    rolling_window: int = 5,
    available_draws: Sequence[AnalysisDraw] | None = None,
    selection_mode: str = "date",
    latest_per_game: int | None = None,
) -> dict[str, Any]:
    if candidate_count < 0:
        raise ValueError("Candidate count cannot be negative.")
    if not draws:
        raise ValueError("No draws are available in the selected date range.")
    games = [
        analyze_game(draws, rule, candidate_count, seed, rolling_window) for rule in ANALYSIS_GAMES
    ]
    actual_start = min(draw.draw_date for draw in draws)
    actual_end = max(draw.draw_date for draw in draws)
    observations = sum(len(draw.numbers) for draw in draws)
    complete_draws = tuple(available_draws or draws)
    available_start = min(draw.draw_date for draw in complete_draws)
    available_end = max(draw.draw_date for draw in complete_draws)
    return {
        "metadata": {
            "requested_start_date": (requested_start_date or actual_start).isoformat(),
            "requested_end_date": (requested_end_date or actual_end).isoformat(),
            "actual_start_date": actual_start.isoformat(),
            "actual_end_date": actual_end.isoformat(),
            "available_start_date": available_start.isoformat(),
            "available_end_date": available_end.isoformat(),
            "draw_count": len(draws),
            "number_observations": observations,
            "selection_mode": selection_mode,
            "latest_per_game": latest_per_game,
            "rolling_window": rolling_window,
            "candidate_count_per_game": candidate_count,
            "candidate_seed": seed,
            "method": "Descriptive statistics and reproducible heuristic sampling; no machine learning.",
            "candidate_disclaimer": (
                "Candidates are not predictions. In a fair draw, every valid outcome has the same "
                "theoretical probability regardless of historical frequency."
            ),
            "coverage_warning": (
                "LottoMatik coverage begins in late December 2023 and can omit some 2PM/5PM "
                "digit-game records. Counts describe only records present in the selected input."
            ),
            "sources": [
                {"name": "PCSO-branded LottoMatik Game Manual", "url": PCSO_GAME_MANUAL_URL},
                {"name": "Official LottoMatik downloads page", "url": LOTTOMATIK_DOWNLOADS_URL},
                {"name": "LottoMatik results", "url": LOTTOMATIK_RESULTS_URL},
            ],
        },
        "games": games,
        "raw_draws": [
            [
                draw.logical_game_code,
                draw.game_code,
                draw.draw_date.isoformat(),
                draw.draw_time,
                list(draw.numbers),
                draw.jackpot,
                draw.winners,
            ]
            for draw in complete_draws
        ],
    }


def _write_csv(path: Path, rows: Iterable[dict[str, Any]]) -> None:
    materialized = list(rows)
    path.parent.mkdir(parents=True, exist_ok=True)
    if not materialized:
        path.write_text("", encoding="utf-8")
        return
    fieldnames = list(materialized[0])
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in materialized:
            writer.writerow(row)


def write_analysis_bundle(analysis: dict[str, Any], output_dir: Path) -> None:
    """Write auditable JSON and per-game CSV tables for a selected date range."""
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "analysis.json").write_text(
        json.dumps(analysis, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    summaries = [game["summary"] for game in analysis["games"] if game["summary"]["draw_count"]]
    _write_csv(output_dir / "game_summary.csv", summaries)
    all_candidates = [
        {"game_code": game["rule"]["code"], "game": game["rule"]["name"], **candidate}
        for game in analysis["games"]
        for candidate in game["candidates"]
    ]
    _write_csv(output_dir / "all_candidates.csv", all_candidates)
    for game in analysis["games"]:
        code = game["rule"]["code"]
        game_dir = output_dir / code
        for key in (
            "frequency",
            "position_frequency",
            "parity_distribution",
            "parity_signatures",
            "draw_time_breakdown",
            "draw_features",
            "scatter",
            "pair_or_transition_frequency",
            "triple_frequency",
            "rolling_frequency",
            "sum_distribution",
            "low_high_distribution",
            "consecutive_distribution",
            "rambolito_frequency",
            "candidates",
        ):
            _write_csv(game_dir / f"{key}.csv", game[key])
        _write_csv(game_dir / "jackpot_statistics.csv", [game["jackpot_statistics"]])
        _write_csv(game_dir / "winner_statistics.csv", [game["winner_statistics"]])
        _write_csv(game_dir / "recommended_candidate.csv", [game["recommended_candidate"]])
