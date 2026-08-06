from __future__ import annotations

import time
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

import httpx

from ..errors import CoverageError, ProviderResponseError, ProviderUnavailableError
from ..games import (
    game_from_lottomatik,
    lottomatik_codes_for_filter,
    matches_game_filter,
    normalize_game_filter,
)
from ..models import DrawResult

LOTTOMATIK_BASE_URL = "https://lottomatik.pcso.gov.ph/api/backend"


class LottoMatikProvider:
    """Read the LottoMatik results JSON feed."""

    name = "lottomatik"

    def __init__(
        self,
        *,
        base_url: str = LOTTOMATIK_BASE_URL,
        timeout_seconds: float = 20,
        per_page: int = 100,
        max_pages: int = 500,
        request_delay: float = 0.05,
        retries: int = 3,
        allow_partial: bool = False,
        client: httpx.Client | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.per_page = per_page
        self.max_pages = max_pages
        self.request_delay = request_delay
        self.retries = max(1, retries)
        self.allow_partial = allow_partial
        self.last_warnings: list[str] = []
        self._owns_client = client is None
        self.client = client or httpx.Client(
            timeout=timeout_seconds,
            follow_redirects=True,
            headers={
                "Accept": "application/json",
                "User-Agent": "philippine-lottery-picker/0.1",
            },
        )

    def close(self) -> None:
        if self._owns_client:
            self.client.close()

    def __enter__(self) -> "LottoMatikProvider":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    @staticmethod
    def _parse_item(item: dict[str, Any], requested_code: str) -> DrawResult:
        try:
            required = {"id", "result", "drawDate", "drawTime", "jackpot", "totalWinners"}
            if not required.issubset(item) or any(item[key] is None for key in required):
                raise TypeError("required field is missing or null")
            draw_date = datetime.strptime(str(item["drawDate"]), "%Y-%m-%d").date()
            draw_time_raw = str(item.get("drawTime") or "")
            game = game_from_lottomatik(requested_code, draw_time_raw)
            if game is None:
                raise ProviderResponseError(
                    f"LottoMatik returned an unsupported draw time for {requested_code}: {draw_time_raw!r}"
                )
            raw_numbers = item["result"]
            expected_length = {"2DL": 2, "3DL": 3, "4DL": 4}.get(requested_code, 6)
            if not isinstance(raw_numbers, list) or len(raw_numbers) != expected_length:
                raise TypeError(f"result must contain {expected_length} numbers")
            if any(not str(number).isdigit() for number in raw_numbers):
                raise TypeError("result values must be digits")
            numeric_numbers = [int(number) for number in raw_numbers]
            if requested_code == "2DL" and any(not 1 <= number <= 31 for number in numeric_numbers):
                raise ValueError("2D result is outside 1..31")
            if requested_code in {"3DL", "4DL", "6DL"} and any(
                not 0 <= number <= 9 for number in numeric_numbers
            ):
                raise ValueError("digit result is outside 0..9")
            ball_maximum = {
                "UL58": 58,
                "GL55": 55,
                "SL49": 49,
                "ML45": 45,
                "LOTTO42": 42,
            }.get(requested_code)
            if ball_maximum is not None:
                if any(not 1 <= number <= ball_maximum for number in numeric_numbers):
                    raise ValueError("lottery ball is outside the game's range")
                if len(set(numeric_numbers)) != len(numeric_numbers):
                    raise ValueError("lottery ball result contains duplicates")
            jackpot = Decimal(str(item["jackpot"]))
            winners = int(item["totalWinners"])
            if jackpot < 0 or winners < 0:
                raise ValueError("jackpot and winners must be non-negative")
            if requested_code in {"3DL", "4DL", "6DL"}:
                numbers = tuple(str(number) for number in numeric_numbers)
            else:
                numbers = tuple(str(number).zfill(2) for number in numeric_numbers)
        except ProviderResponseError:
            raise
        except (KeyError, TypeError, ValueError, InvalidOperation) as exc:
            raise ProviderResponseError("LottoMatik returned a malformed draw record") from exc

        return DrawResult(
            game_code=game.code,
            game=game.name,
            numbers=numbers,
            draw_date=draw_date,
            draw_time=game.draw_time,
            jackpot=jackpot,
            winners=winners,
            source_id=str(item.get("id")) if item.get("id") is not None else None,
        )

    def _get_page(self, game_code: str, page: int) -> dict[str, Any]:
        last_error: Exception | None = None
        for attempt in range(self.retries):
            try:
                response = self.client.get(
                    f"{self.base_url}/get-game-history",
                    params={"lottery": game_code, "page": page, "perPage": self.per_page},
                )
                if response.status_code == 429 or response.status_code >= 500:
                    response.raise_for_status()
                if response.is_error:
                    raise ProviderUnavailableError(
                        f"LottoMatik returned HTTP {response.status_code} for {game_code}"
                    )
                payload = response.json()
                break
            except ProviderUnavailableError:
                raise
            except (httpx.HTTPError, ValueError) as exc:
                last_error = exc
                if attempt + 1 < self.retries:
                    time.sleep(min(0.25 * (2**attempt), 1.0))
        else:
            raise ProviderUnavailableError(
                f"LottoMatik request failed for {game_code}: {last_error}"
            ) from last_error
        if not isinstance(payload, dict) or not isinstance(payload.get("items"), list):
            raise ProviderResponseError("LottoMatik returned an unexpected history response")
        return payload

    def fetch(self, start_date: date, end_date: date, game: str | None = None) -> list[DrawResult]:
        if end_date < start_date:
            raise ValueError("end_date must not be before start_date")
        game_filter = normalize_game_filter(game)
        self.last_warnings = []
        results: list[DrawResult] = []

        for game_code in lottomatik_codes_for_filter(game_filter):
            page = 1
            oldest_seen: date | None = None
            reached_end = False
            while page <= self.max_pages:
                payload = self._get_page(game_code, page)
                items = payload["items"]
                parsed = [self._parse_item(item, game_code) for item in items]
                for result in parsed:
                    if start_date <= result.draw_date <= end_date and matches_game_filter(
                        result.game_code, game_filter
                    ):
                        results.append(result)

                total_pages = int(payload.get("totalPages") or page)
                oldest_date = min((result.draw_date for result in parsed), default=None)
                if oldest_date is not None:
                    oldest_seen = min(oldest_seen, oldest_date) if oldest_seen else oldest_date
                if not items or page >= total_pages or (oldest_date is not None and oldest_date < start_date):
                    reached_end = not items or page >= total_pages
                    break
                page += 1
                if self.request_delay:
                    time.sleep(self.request_delay)
            else:
                raise ProviderResponseError(
                    f"LottoMatik pagination exceeded the safety limit for {game_code}"
                )
            if reached_end and oldest_seen is not None and start_date < oldest_seen:
                message = (
                    f"LottoMatik {game_code} history begins at {oldest_seen.isoformat()}, "
                    f"after the requested start date {start_date.isoformat()}"
                )
                if not self.allow_partial:
                    raise CoverageError(f"{message}; rerun with --allow-partial to accept incomplete data")
                self.last_warnings.append(message)
        return results
