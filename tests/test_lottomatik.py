from datetime import date

import httpx
import pytest

from lottery_picker.errors import CoverageError, ProviderResponseError
from lottery_picker.providers.lottomatik import LottoMatikProvider


def test_lottomatik_history_paginates_and_filters_dates():
    requests = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        page = int(request.url.params["page"])
        if page == 1:
            return httpx.Response(
                200,
                json={
                    "page": 1,
                    "totalPages": 2,
                    "items": [
                        {
                            "id": "UL58-new",
                            "drawDate": "2026-08-04",
                            "drawTime": "21:00:00+08",
                            "result": ["01", "02", "03", "04", "05", "06"],
                            "jackpot": 12345678.5,
                            "totalWinners": 0,
                        }
                    ],
                },
            )
        return httpx.Response(
            200,
            json={
                "page": 2,
                "totalPages": 2,
                "items": [
                    {
                        "id": "UL58-old",
                        "drawDate": "2026-07-29",
                        "drawTime": "21:00:00+08",
                        "result": [1, 2, 3, 4, 5, 6],
                        "jackpot": 100,
                        "totalWinners": 1,
                    }
                ],
            },
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))
    provider = LottoMatikProvider(client=client, request_delay=0)
    results = provider.fetch(date(2026, 8, 1), date(2026, 8, 5), "UL58")

    assert len(requests) == 2
    assert [result.source_id for result in results] == ["UL58-new"]
    assert results[0].numbers == ("01", "02", "03", "04", "05", "06")


def test_lottomatik_maps_digit_draw_time_to_game():
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "page": 1,
                "totalPages": 1,
                "items": [
                    {
                        "id": "3DL-1",
                        "drawDate": "2026-08-05",
                        "drawTime": "14:00:00+08",
                        "result": [8, 0, 6],
                        "jackpot": 4500,
                        "totalWinners": 323,
                    }
                ],
            },
        )

    provider = LottoMatikProvider(
        client=httpx.Client(transport=httpx.MockTransport(handler)), request_delay=0
    )
    results = provider.fetch(date(2026, 8, 5), date(2026, 8, 5), "3DL-2PM")
    assert results[0].game_code == "3DL-2PM"
    assert results[0].numbers == ("8", "0", "6")


def test_lottomatik_rejects_missing_prize_fields():
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "page": 1,
                "totalPages": 1,
                "items": [
                    {
                        "id": "UL58-bad",
                        "drawDate": "2026-08-04",
                        "drawTime": "21:00:00+08",
                        "result": ["01", "02", "03", "04", "05", "06"],
                        "totalWinners": 0,
                    }
                ],
            },
        )

    provider = LottoMatikProvider(
        client=httpx.Client(transport=httpx.MockTransport(handler)), request_delay=0
    )
    with pytest.raises(ProviderResponseError):
        provider.fetch(date(2026, 8, 1), date(2026, 8, 5), "UL58")


def test_lottomatik_rejects_uncovered_range_unless_partial_is_allowed():
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "page": 1,
                "totalPages": 1,
                "items": [
                    {
                        "id": "GL55-first",
                        "drawDate": "2023-12-23",
                        "drawTime": "21:00:00+08",
                        "result": ["01", "02", "03", "04", "05", "06"],
                        "jackpot": 0,
                        "totalWinners": 0,
                    }
                ],
            },
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))
    provider = LottoMatikProvider(client=client, request_delay=0)
    with pytest.raises(CoverageError):
        provider.fetch(date(2020, 1, 1), date(2020, 1, 2), "GL55")

    partial = LottoMatikProvider(client=client, request_delay=0, allow_partial=True)
    assert partial.fetch(date(2020, 1, 1), date(2020, 1, 2), "GL55") == []
    assert "2023-12-23" in partial.last_warnings[0]
