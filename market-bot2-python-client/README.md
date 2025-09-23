# Ethereal Python Client

A Python client wrapper for the Ethereal SDK providing simplified access to Ethereal's trading and market data APIs.

## Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd market-bot2-python-client
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

## Configuration

### Environment Variables

Create a `.env` file based on the provided template:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# API Configuration
ETHEREAL_BASE_URL=https://api.etherealtest.net
ETHEREAL_RPC_URL=https://rpc.etherealtest.net

# Account Configuration (optional for read-only access)
ETHEREAL_ADDRESS=0xYourWalletAddressHere

# Trading Configuration (required for placing orders)
ETHEREAL_PRIVATE_KEY=your_private_key_here
```

### Configuration Options

- **Read-only access**: Only requires `base_url` and `rpc_url`
- **Account data access**: Requires `address` in addition to read-only config
- **Trading capabilities**: Requires `private_key` for order placement and cancellation

## Usage

### Basic Usage

```python
from ethereal_client import EtherealClient

# Initialize client (loads from .env file)
client = EtherealClient()

# Check client capabilities
print(f"Can read account data: {client.is_configured_for_reading}")
print(f"Can trade: {client.is_configured_for_trading}")

# Get market data (no authentication required)
products = client.get_products()
tokens = client.get_tokens()
order_book = client.get_order_book("ETH-USD")
```

### Advanced Configuration

```python
from ethereal_client import EtherealClient
from config import EtherealConfig

# Method 1: Direct parameters
client = EtherealClient(
    base_url="https://api.etherealtest.net",
    rpc_url="https://rpc.etherealtest.net",
    address="0x123...",
    private_key="your_private_key"
)

# Method 2: Using config class
config = EtherealConfig.from_env()
client = EtherealClient(
    base_url=config.base_url,
    rpc_url=config.rpc_url,
    address=config.address,
    private_key=config.private_key
)

# Method 3: Custom config file
client = EtherealClient(config_file=".env.production")
```

### Trading Operations

```python
# Get account information (requires address)
if client.is_configured_for_reading:
    account = client.get_account_info()
    balances = client.get_balances()

    # Get subaccounts and default subaccount ID
    subaccounts = client.list_subaccounts()
    default_subaccount_id = client.get_default_subaccount_id()

    # List orders for a subaccount
    orders = client.list_orders(subaccount_id=default_subaccount_id)

# Place orders (requires private key)
if client.is_configured_for_trading:
    # Create a limit order using new API
    order = client.create_order(
        ticker="BTCUSD",
        side="buy",
        quantity=0.001,
        order_type="LIMIT",
        price=50000.0
    )

    # Cancel orders (can cancel multiple at once)
    client.cancel_orders(
        order_ids=[order["id"]],
        subaccount="default"
    )

    # Legacy method still works for backward compatibility
    legacy_order = client.place_order(
        product_id="ETH-USD",
        side="buy",
        size="0.01",
        price="2000.00",
        order_type="limit"
    )
```

## Error Handling

The client uses custom exceptions for better error handling:

```python
from ethereal_client import EtherealClient
from exceptions import (
    ConfigurationError,
    InsufficientPermissionsError,
    APIError,
    NetworkError,
    ValidationError
)

try:
    client = EtherealClient()
    products = client.get_products()
except ConfigurationError as e:
    print(f"Configuration issue: {e}")
except NetworkError as e:
    print(f"Network problem: {e}")
except APIError as e:
    print(f"API error: {e}")
```

## Example

Run the example script to see the client in action:

```bash
python example_usage.py
```

## API Reference

### EtherealClient

#### Methods

**Market Data (no authentication required)**
- `get_products()` - List available trading products
- `get_tokens()` - List available tokens
- `get_order_book(product_id)` - Get order book for a product
- `get_market_data(product_id)` - Get market data for a product

**Account Management (requires address)**
- `get_account_info()` - Get account information
- `get_balances()` - Get account balances
- `list_subaccounts()` - List all subaccounts
- `get_subaccount(subaccount_id)` - Get subaccount details
- `get_default_subaccount_id()` - Get default subaccount ID
- `list_orders(subaccount_id, ...)` - List orders for a subaccount

**Trading Operations (requires private key)**
- `create_order(ticker, side, quantity, ...)` - Create trading order (new API)
- `cancel_orders(order_ids, subaccount, ...)` - Cancel multiple orders (new API)
- `create_subaccount(name)` - Create new subaccount

**Legacy Methods (for backward compatibility)**
- `get_orders(status=None, subaccount_id=None)` - Get orders (use list_orders instead)
- `place_order(product_id, side, size, ...)` - Place order (use create_order instead)
- `cancel_order(order_id, subaccount="default")` - Cancel single order (use cancel_orders instead)

#### Properties

- `is_configured_for_reading` - Check if client can read account data
- `is_configured_for_trading` - Check if client can place trades

## Security Notes

- Never commit private keys to version control
- Use environment variables or secure key management for production
- The testnet URLs are used by default for safety

## License

[Add your license information here]