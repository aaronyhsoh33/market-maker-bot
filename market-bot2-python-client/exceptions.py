"""
Custom exceptions for Ethereal Client
"""


class EtherealClientError(Exception):
    """Base exception for Ethereal client errors."""
    pass


class ConfigurationError(EtherealClientError):
    """Raised when client configuration is invalid or incomplete."""
    pass


class AuthenticationError(EtherealClientError):
    """Raised when authentication credentials are invalid."""
    pass


class InsufficientPermissionsError(EtherealClientError):
    """Raised when operation requires higher permissions (e.g., trading without private key)."""
    pass


class APIError(EtherealClientError):
    """Raised when API returns an error response."""

    def __init__(self, message: str, status_code: int = None, response_data: dict = None):
        super().__init__(message)
        self.status_code = status_code
        self.response_data = response_data or {}


class NetworkError(EtherealClientError):
    """Raised when network/connection errors occur."""
    pass


class ValidationError(EtherealClientError):
    """Raised when input validation fails."""
    pass