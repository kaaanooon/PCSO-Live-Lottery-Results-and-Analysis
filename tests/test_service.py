from datetime import date
from decimal import Decimal

from lottery_picker.models import DrawResult
from lottery_picker.service import LotteryService


class WorkingProvider:
    name = "lottomatik"
    last_warnings = []

    def fetch(self, *_args, **_kwargs):
        result = DrawResult(
            game_code="GL55",
            game="Grand Lotto 6/55",
            numbers=("01", "02", "03", "04", "05", "06"),
            draw_date=date(2026, 8, 5),
            draw_time="21:00",
            jackpot=Decimal("15000000"),
            winners=0,
        )
        return [result, result]


def test_service_fetches_lottomatik_and_deduplicates():
    service = LotteryService(lottomatik=WorkingProvider())
    outcome = service.fetch(date(2026, 8, 1), date(2026, 8, 5))
    assert len(outcome.results) == 1
    assert "LottoMatik coverage" in outcome.warnings[0]


class DuplicateQualityProvider:
    name = "lottomatik"
    last_warnings = []

    def fetch(self, *_args, **_kwargs):
        poor = WorkingProvider().fetch()[0]
        complete = DrawResult(
            game_code=poor.game_code,
            game=poor.game,
            numbers=poor.numbers,
            draw_date=poor.draw_date,
            draw_time=poor.draw_time,
            jackpot=Decimal("16000000"),
            winners=1,
            source_id="GL55S0000001",
        )
        return [complete, poor]


def test_deduplication_keeps_more_complete_record():
    service = LotteryService(lottomatik=DuplicateQualityProvider())
    outcome = service.fetch(date(2026, 8, 1), date(2026, 8, 5))
    assert outcome.results[0].jackpot == Decimal("16000000")


class OrderedProvider:
    name = "lottomatik"
    last_warnings = []

    def fetch(self, *_args, **_kwargs):
        newer = WorkingProvider().fetch()[0]
        older = DrawResult(
            game_code=newer.game_code,
            game=newer.game,
            numbers=("07", "08", "09", "10", "11", "12"),
            draw_date=date(2026, 8, 3),
            draw_time=newer.draw_time,
            jackpot=newer.jackpot,
            winners=newer.winners,
            source_id="GL55S-old",
        )
        return [newer, older]


def test_oldest_order_sorts_chronologically():
    service = LotteryService(lottomatik=OrderedProvider())
    outcome = service.fetch(
        date(2026, 8, 1), date(2026, 8, 5), order="oldest"
    )
    assert [result.draw_date for result in outcome.results] == [
        date(2026, 8, 3),
        date(2026, 8, 5),
    ]
