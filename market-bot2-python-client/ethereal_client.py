"""
Ethereal Python Client Wrapper

A Python client wrapper for the Ethereal SDK providing simplified access to
Ethereal's trading and market data APIs.
"""

import os
import logging
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv
from ethereal import RESTClient
from exceptions import (
    EtherealClientError,
    ConfigurationError,
    InsufficientPermissionsError,
    APIError,
    NetworkError,
    ValidationError
)


class EtherealClient:
    """
    Wrapper client for Ethereal SDK providing simplified access to trading and market data.
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        rpc_url: Optional[str] = None,
        address: Optional[str] = None,
        private_key: Optional[str] = None,
        config_file: Optional[str] = None
    ):
        """
        Initialize the Ethereal client.

        Args:
            base_url: API base URL (defaults to environment variable or testnet)
            rpc_url: RPC URL for blockchain interaction
            address: Wallet address for read-only operations
            private_key: Private key for trading operations
            config_file: Path to .env file for configuration
        """
        if config_file:
            load_dotenv(config_file)
        else:
            load_dotenv()

        self.base_url = base_url or os.getenv('ETHEREAL_BASE_URL', 'https://api.etherealtest.net')
        self.rpc_url = rpc_url or os.getenv('ETHEREAL_RPC_URL', 'https://rpc.etherealtest.net')
        self.address = address or os.getenv('ETHEREAL_ADDRESS')
        self.private_key = private_key or os.getenv('ETHEREAL_PRIVATE_KEY')
        self.subaccount_id = os.getenv('ETHEREAL_SUBACCOUNT_ID')

        self._client = self._initialize_client()

    def _initialize_client(self) -> RESTClient:
        """Initialize the underlying RESTClient with configuration."""
        try:
            config = {
                "base_url": self.base_url,
                "chain_config": {
                    "rpc_url": self.rpc_url,
                }
            }

            if self.address:
                config["chain_config"]["address"] = self.address

            if self.private_key:
                config["chain_config"]["private_key"] = self.private_key

            return RESTClient(config)
        except Exception as e:
            raise ConfigurationError(f"Failed to initialize Ethereal client: {str(e)}")

    def _handle_api_error(self, e: Exception, operation: str) -> None:
        """Handle and re-raise API errors with appropriate context."""
        error_msg = f"Failed to {operation}: {str(e)}"

        if "network" in str(e).lower() or "connection" in str(e).lower():
            raise NetworkError(error_msg)
        elif "unauthorized" in str(e).lower() or "forbidden" in str(e).lower():
            raise InsufficientPermissionsError(error_msg)
        else:
            raise APIError(error_msg)

    def get_products(self) -> List[Dict[str, Any]]:
        """
        Get list of available trading products.

        Returns:
            List of product dictionaries
        """
        try:
            return self._client.list_products()
        except Exception as e:
            self._handle_api_error(e, "get products")

    def get_tokens(self) -> List[Dict[str, Any]]:
        """
        Get list of available tokens.

        Returns:
            List of token dictionaries
        """
        return self._client.list_tokens()

    def get_account_info(self) -> Dict[str, Any]:
        """
        Get account information (requires address configuration).

        Returns:
            Account information dictionary
        """
        if not self.address:
            raise InsufficientPermissionsError("Address must be configured to get account info")
        try:
            return self._client.get_account()
        except Exception as e:
            self._handle_api_error(e, "get account info")

    def get_balances(self) -> Dict[str, Any]:
        """
        Get account balances (requires address configuration).

        Returns:
            Balances dictionary
        """
        if not self.address:
            raise ValueError("Address must be configured to get balances")
        return self._client.get_balances()

    def create_order(
        self,
        ticker: str,
        side: str,
        quantity: float,
        order_type: str,
        price: Optional[float] = None,
        product_id: Optional[str] = None,
        expires_at: Optional[int] = None,
        sign: bool = True,
        submit: bool = True
    ) -> Dict[str, Any]:
        """
        Create a trading order using Ethereal SDK's create_order method.

        Args:
            ticker: Trading pair symbol (e.g., 'BTCUSD')
            side: 'buy' or 'sell'
            quantity: Order quantity/size
            order_type: Order type ('LIMIT' or 'MARKET')
            price: Order price (required for LIMIT orders)
            product_id: Product identifier (optional, can use ticker instead)
            expires_at: Expiry timestamp for GTD (Good Till Date) orders
            sign: Whether to sign the order (default True)
            submit: Whether to submit the order (default True)

        Returns:
            Order creation response dictionary
        """
        if not self.private_key:
            raise InsufficientPermissionsError("Private key must be configured to create orders")

        if side not in ["buy", "sell"]:
            raise ValidationError("Order side must be 'buy' or 'sell'")

        if order_type not in ["LIMIT", "MARKET"]:
            raise ValidationError("Order type must be 'LIMIT' or 'MARKET'")

        # Convert side to integer format expected by API
        side_int = 0 if side.lower() == "buy" else 1

        if order_type == "LIMIT" and price is None:
            raise ValidationError("Price is required for LIMIT orders")

        try:
            return self._client.create_order(
                order_type=order_type,
                quantity=quantity,
                side=side_int,
                price=price,
                ticker=ticker,
                product_id=product_id,
                expires_at=expires_at,
                sign=sign,
                submit=submit
            )
        except Exception as e:
            self._handle_api_error(e, "create order")

    # Legacy method for backward compatibility
    def place_order(
        self,
        product_id: str,
        side: str,
        size: str,
        price: Optional[str] = None,
        order_type: str = "limit"
    ) -> Dict[str, Any]:
        """
        Legacy method for placing orders. Use create_order() instead.

        Args:
            product_id: Product identifier
            side: 'buy' or 'sell'
            size: Order size
            price: Order price (required for limit orders)
            order_type: Order type ('limit' or 'market')

        Returns:
            Order confirmation dictionary
        """
        # Convert legacy format to new API format
        order_type_upper = order_type.upper()
        price_float = float(price) if price else None
        quantity_float = float(size)

        return self.create_order(
            ticker=product_id,
            side=side,
            quantity=quantity_float,
            order_type=order_type_upper,
            price=price_float
        )

    def cancel_orders(
        self,
        order_ids: List[str],
        subaccount: str,
        client_order_ids: Optional[List[str]] = None,
        sign: bool = True,
        submit: bool = True
    ) -> Dict[str, Any]:
        """
        Cancel multiple orders using Ethereal SDK's cancel_orders method.

        Args:
            order_ids: List of order IDs to cancel
            subaccount: Subaccount name
            client_order_ids: List of client order IDs (optional)
            sign: Whether to sign the cancellation (default True)
            submit: Whether to submit the cancellation (default True)

        Returns:
            Cancellation results dictionary
        """
        if not self.private_key:
            raise InsufficientPermissionsError("Private key must be configured to cancel orders")

        if not self.address:
            raise InsufficientPermissionsError("Address must be configured to cancel orders")

        if not order_ids:
            raise ValidationError("At least one order ID must be provided")

        try:
            return self._client.cancel_orders(
                order_ids=order_ids,
                sender=self.address,
                subaccount=subaccount,
                client_order_ids=client_order_ids or [],
                sign=sign,
                submit=submit
            )
        except Exception as e:
            self._handle_api_error(e, "cancel orders")

    # Legacy method for backward compatibility
    def cancel_order(self, order_id: str, subaccount: str = "default") -> Dict[str, Any]:
        """
        Cancel a single order. Use cancel_orders() for better performance.

        Args:
            order_id: Order ID to cancel
            subaccount: Subaccount name (default: "default")

        Returns:
            Cancellation confirmation dictionary
        """
        return self.cancel_orders(
            order_ids=[order_id],
            subaccount=subaccount
        )

    def list_orders(
        self,
        subaccount_id: str,
        product_ids: Optional[List[str]] = None,
        statuses: Optional[List[str]] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        List orders using Ethereal SDK's list_orders method.

        Args:
            subaccount_id: Subaccount ID to get orders for
            product_ids: Filter by product IDs (optional)
            statuses: Filter by order statuses (optional)
            limit: Maximum number of orders to return (optional)
            offset: Number of orders to skip (optional)

        Returns:
            List of order dictionaries
        """
        if not self.address:
            raise InsufficientPermissionsError("Address must be configured to list orders")

        try:
            return self._client.list_orders(
                subaccount_id=subaccount_id,
                product_ids=product_ids,
                statuses=statuses,
                limit=limit,
                offset=offset
            )
        except Exception as e:
            self._handle_api_error(e, "list orders")

    # Legacy method for backward compatibility
    def get_orders(self, status: Optional[str] = None, subaccount_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Legacy method for getting orders. Use list_orders() instead.

        Args:
            status: Filter by order status (optional)
            subaccount_id: Subaccount ID (required for new API)

        Returns:
            List of order dictionaries
        """
        if not subaccount_id:
            raise ValidationError("subaccount_id is required. Use list_orders() method directly for better control.")

        statuses = [status] if status else None
        return self.list_orders(
            subaccount_id=subaccount_id,
            statuses=statuses
        )

    def get_order_book(self, product_id: str) -> Dict[str, Any]:
        """
        Get order book for a specific product.

        Args:
            product_id: Product identifier

        Returns:
            Order book dictionary with bids and asks
        """
        return self._client.get_order_book(product_id)

    def get_market_data(self, product_id: str) -> Dict[str, Any]:
        """
        Get market data for a specific product.

        Args:
            product_id: Product identifier

        Returns:
            Market data dictionary
        """
        return self._client.get_market_data(product_id)

    # Subaccount management helper methods
    def list_subaccounts(self) -> List[Dict[str, Any]]:
        """
        List all subaccounts for the current address.

        Returns:
            List of subaccount dictionaries
        """
        if not self.address:
            raise InsufficientPermissionsError("Address must be configured to list subaccounts")

        try:
            return self._client.list_subaccounts()
        except Exception as e:
            self._handle_api_error(e, "list subaccounts")

    def get_subaccount(self, subaccount_id: str) -> Dict[str, Any]:
        """
        Get details for a specific subaccount.

        Args:
            subaccount_id: Subaccount ID to retrieve

        Returns:
            Subaccount details dictionary
        """
        if not self.address:
            raise InsufficientPermissionsError("Address must be configured to get subaccount details")

        try:
            return self._client.get_subaccount(subaccount_id)
        except Exception as e:
            self._handle_api_error(e, "get subaccount")

    def create_subaccount(self, name: str) -> Dict[str, Any]:
        """
        Create a new subaccount.

        Args:
            name: Name for the new subaccount

        Returns:
            Created subaccount details dictionary
        """
        if not self.private_key:
            raise InsufficientPermissionsError("Private key must be configured to create subaccounts")

        try:
            return self._client.create_subaccount(name=name)
        except Exception as e:
            self._handle_api_error(e, "create subaccount")

    # Helper method for getting default subaccount
    def get_default_subaccount_id(self) -> str:
        """
        Get the default subaccount ID for the current address.

        Returns:
            Default subaccount ID
        """
        try:
            subaccounts = self.list_subaccounts()
            if not subaccounts:
                raise ValidationError("No subaccounts found for this address")

            # Look for default subaccount or return the first one
            for subaccount in subaccounts:
                if subaccount.get('name') == 'default' or subaccount.get('is_default', False):
                    return subaccount.get('id')

            # If no default found, return the first subaccount ID
            return subaccounts[0].get('id')

        except Exception as e:
            self._handle_api_error(e, "get default subaccount ID")

    @property
    def is_configured_for_trading(self) -> bool:
        """Check if client is configured for trading (has private key)."""
        return self.private_key is not None

    @property
    def is_configured_for_reading(self) -> bool:
        """Check if client is configured for reading account data (has address)."""
        return self.address is not None