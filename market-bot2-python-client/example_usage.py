"""
Example usage of the Ethereal Client wrapper

This example demonstrates how to use the EtherealClient for both
read-only market data access and trading operations.
"""

import asyncio
from ethereal_client import EtherealClient
from config import EtherealConfig
from exceptions import EtherealClientError, InsufficientPermissionsError


def main():
    """Main example function demonstrating client usage."""

    # Example 1: Initialize client with environment variables
    print("=== Initializing Ethereal Client ===")
    try:
        client = EtherealClient()
        print(f"Client initialized successfully")
        print(f"Base URL: {client.base_url}")
        print(f"Can read account data: {client.is_configured_for_reading}")
        print(f"Can trade: {client.is_configured_for_trading}")
    except EtherealClientError as e:
        print(f"Failed to initialize client: {e}")
        return

    # Example 2: Get market data (no authentication required)
    print("\n=== Getting Market Data ===")
    try:
        products = client.get_products()
        print(f"Found {len(products)} products:")
        for product in products[:3]:  # Show first 3 products
            print(f"  - {product.get('id', 'N/A')}: {product.get('name', 'N/A')}")

        tokens = client.get_tokens()
        print(f"\nFound {len(tokens)} tokens:")
        for token in tokens[:3]:  # Show first 3 tokens
            print(f"  - {token.get('symbol', 'N/A')}: {token.get('name', 'N/A')}")

    except EtherealClientError as e:
        print(f"Failed to get market data: {e}")

    # Example 3: Get account information (requires address)
    print("\n=== Getting Account Information ===")
    try:
        if client.is_configured_for_reading:
            account_info = client.get_account_info()
            print(f"Account ID: {account_info.get('id', 'N/A')}")

            balances = client.get_balances()
            print(f"Account balances:")
            for balance in balances.get('balances', [])[:3]:  # Show first 3 balances
                print(f"  - {balance.get('currency', 'N/A')}: {balance.get('available', 'N/A')}")
        else:
            print("Skipping account info - no address configured")
    except InsufficientPermissionsError as e:
        print(f"Cannot access account info: {e}")
    except EtherealClientError as e:
        print(f"Failed to get account info: {e}")

    # Example 4: Get order book for a product
    print("\n=== Getting Order Book ===")
    try:
        if products:
            product_id = products[0].get('id')
            if product_id:
                order_book = client.get_order_book(product_id)
                print(f"Order book for {product_id}:")
                print(f"  - Bids: {len(order_book.get('bids', []))}")
                print(f"  - Asks: {len(order_book.get('asks', []))}")
    except EtherealClientError as e:
        print(f"Failed to get order book: {e}")

    # Example 5: Subaccount management
    print("\n=== Subaccount Management ===")
    try:
        if client.is_configured_for_reading:
            subaccounts = client.list_subaccounts()
            print(f"Found {len(subaccounts)} subaccounts:")
            for subaccount in subaccounts[:3]:  # Show first 3
                print(f"  - {subaccount.get('name', 'N/A')}: {subaccount.get('id', 'N/A')}")

            # Get default subaccount for future operations
            default_subaccount_id = client.get_default_subaccount_id()
            print(f"Default subaccount ID: {default_subaccount_id}")
        else:
            print("Skipping subaccount info - no address configured")
    except InsufficientPermissionsError as e:
        print(f"Cannot access subaccount info: {e}")
    except EtherealClientError as e:
        print(f"Failed to get subaccount info: {e}")

    # Example 6: Trading operations (requires private key)
    print("\n=== Trading Operations ===")
    if client.is_configured_for_trading and client.is_configured_for_reading:
        try:
            # Get default subaccount for operations
            default_subaccount_id = client.get_default_subaccount_id()

            # Get existing orders using new API
            orders = client.list_orders(subaccount_id=default_subaccount_id)
            print(f"Current orders: {len(orders)}")

            # Example order creation (commented out for safety)
            # new_order = client.create_order(
            #     ticker="BTCUSD",
            #     side="buy",
            #     quantity=0.001,
            #     order_type="LIMIT",
            #     price=50000.0
            # )
            # print(f"Order created: {new_order.get('id')}")

            # Example order cancellation (commented out for safety)
            # if orders:
            #     order_to_cancel = orders[0].get('id')
            #     cancel_result = client.cancel_orders(
            #         order_ids=[order_to_cancel],
            #         subaccount="default"
            #     )
            #     print(f"Order cancelled: {cancel_result}")

        except InsufficientPermissionsError as e:
            print(f"Cannot perform trading operations: {e}")
        except EtherealClientError as e:
            print(f"Trading operation failed: {e}")
    else:
        print("Skipping trading operations - requires both private key and address configured")


def configuration_examples():
    """Examples of different ways to configure the client."""

    print("\n=== Configuration Examples ===")

    # Method 1: From environment variables
    config1 = EtherealConfig.from_env()
    client1 = EtherealClient(
        base_url=config1.base_url,
        rpc_url=config1.rpc_url,
        address=config1.address,
        private_key=config1.private_key
    )
    print("Method 1: From environment - OK")

    # Method 2: Direct parameters
    client2 = EtherealClient(
        base_url="https://api.etherealtest.net",
        rpc_url="https://rpc.etherealtest.net",
        address="0x123...",  # Your address here
        private_key=None      # No trading
    )
    print("Method 2: Direct parameters - OK")

    # Method 3: Custom .env file
    client3 = EtherealClient(config_file=".env.custom")
    print("Method 3: Custom config file - OK")


if __name__ == "__main__":
    try:
        main()
        configuration_examples()
    except KeyboardInterrupt:
        print("\nExample interrupted by user")
    except Exception as e:
        print(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()