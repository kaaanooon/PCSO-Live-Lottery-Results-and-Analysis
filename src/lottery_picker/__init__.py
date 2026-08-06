"""Philippine lottery result fetcher."""

from .models import DrawResult, FetchOutcome
from .service import LotteryService

__all__ = ["DrawResult", "FetchOutcome", "LotteryService"]
__version__ = "0.3.0"
