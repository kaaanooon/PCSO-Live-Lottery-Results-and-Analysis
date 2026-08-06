class LotteryPickerError(Exception):
    """Base exception for expected application failures."""


class InvalidInputError(LotteryPickerError):
    """The requested date range, game, or option is invalid."""


class OutputError(LotteryPickerError):
    """Rendered results could not be written to their destination."""


class ProviderError(LotteryPickerError):
    """A result provider could not return trustworthy data."""


class ProviderUnavailableError(ProviderError):
    """A provider could not be reached or its required runtime is unavailable."""


class ProviderResponseError(ProviderError):
    """A provider returned an unexpected page or response."""


class CoverageError(ProviderError):
    """A provider does not cover the full requested date range."""
