"""
Flask API Server for Ethereal Client

This server wraps the EtherealClient and provides REST API endpoints
for testing with Postman or other HTTP clients.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from ethereal_client import EtherealClient
from exceptions import (
    EtherealClientError,
    ConfigurationError,
    InsufficientPermissionsError,
    APIError,
    NetworkError,
    ValidationError
)
import traceback
import json
from dataclasses import asdict, is_dataclass
from typing import Any

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize the Ethereal client globally
try:
    from ethereal import AsyncRESTClient
    client = EtherealClient()

    # Also initialize the async client directly for async operations
    async_client_config = {
        "base_url": client.base_url,
        "chain_config": {
            "rpc_url": client.rpc_url,
        }
    }
    if client.address:
        async_client_config["chain_config"]["address"] = client.address
    if client.private_key:
        async_client_config["chain_config"]["private_key"] = client.private_key

    print(f"Async client config: {async_client_config}")

    # Initialize async client using the create method
    import asyncio
    async def init_async_client():
        return await AsyncRESTClient.create(async_client_config)

    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        async_client = loop.run_until_complete(init_async_client())
        print(f"✅ Async client initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize async client: {e}")
        async_client = None

    print(f"✅ Ethereal client initialized")
    print(f"Base URL: {client.base_url}")
    print(f"Can read account: {client.is_configured_for_reading}")
    print(f"Can trade: {client.is_configured_for_trading}")
except Exception as e:
    print(f"❌ Failed to initialize Ethereal client: {e}")
    client = None
    async_client = None


def serialize_response(obj: Any, _seen=None) -> Any:
    """Convert Ethereal SDK objects to JSON-serializable format with recursion protection."""
    if _seen is None:
        _seen = set()

    # Prevent infinite recursion
    obj_id = id(obj)
    if obj_id in _seen:
        return f"<Circular reference to {type(obj).__name__}>"

    if obj is None:
        return None

    # Handle basic JSON-serializable types first
    if isinstance(obj, (str, int, float, bool)):
        return obj

    # Handle datetime objects
    if hasattr(obj, 'isoformat'):
        return obj.isoformat()

    _seen.add(obj_id)

    try:
        # First, try JSON serialization to see if it's already compatible
        try:
            json.dumps(obj)
            _seen.remove(obj_id)
            return obj
        except (TypeError, ValueError):
            pass

        # Try Pydantic v2 first (model_dump)
        if hasattr(obj, 'model_dump') and callable(getattr(obj, 'model_dump')):
            try:
                result = obj.model_dump()
                _seen.remove(obj_id)
                return serialize_response(result, _seen)
            except Exception:
                pass

        # Try Pydantic v1 (dict method)
        if hasattr(obj, 'dict') and callable(getattr(obj, 'dict')):
            try:
                result = obj.dict()
                _seen.remove(obj_id)
                return serialize_response(result, _seen)
            except Exception:
                pass

        # Try dataclass serialization
        if is_dataclass(obj):
            try:
                result = asdict(obj)
                _seen.remove(obj_id)
                return serialize_response(result, _seen)
            except Exception:
                pass

        # Handle collections
        if isinstance(obj, (list, tuple)):
            result = [serialize_response(item, _seen) for item in obj]
            _seen.remove(obj_id)
            return result

        if isinstance(obj, dict):
            result = {str(key): serialize_response(value, _seen) for key, value in obj.items()}
            _seen.remove(obj_id)
            return result

        # Try to extract attributes manually
        if hasattr(obj, '__dict__'):
            try:
                attrs = {}
                for key, value in obj.__dict__.items():
                    if not key.startswith('_'):  # Skip private attributes
                        try:
                            attrs[str(key)] = serialize_response(value, _seen)
                        except Exception:
                            attrs[str(key)] = str(value)
                _seen.remove(obj_id)
                return attrs
            except Exception:
                pass

        # Last resort: convert to string representation
        _seen.remove(obj_id)
        return {
            "type": str(type(obj).__name__),
            "string_representation": str(obj)[:500]  # Limit length
        }

    except Exception as e:
        _seen.discard(obj_id)
        return {
            "serialization_error": str(e),
            "object_type": str(type(obj).__name__)
        }


def handle_error(e):
    """Convert exceptions to appropriate HTTP responses."""
    if isinstance(e, ValidationError):
        return jsonify({"error": "Validation Error", "message": str(e)}), 400
    elif isinstance(e, InsufficientPermissionsError):
        return jsonify({"error": "Insufficient Permissions", "message": str(e)}), 403
    elif isinstance(e, ConfigurationError):
        return jsonify({"error": "Configuration Error", "message": str(e)}), 500
    elif isinstance(e, NetworkError):
        return jsonify({"error": "Network Error", "message": str(e)}), 502
    elif isinstance(e, APIError):
        return jsonify({"error": "API Error", "message": str(e)}), 500
    elif isinstance(e, EtherealClientError):
        return jsonify({"error": "Client Error", "message": str(e)}), 500
    else:
        return jsonify({"error": "Internal Server Error", "message": str(e)}), 500


@app.errorhandler(Exception)
def handle_exception(e):
    """Global exception handler."""
    print(f"Unhandled exception: {e}")
    traceback.print_exc()
    return handle_error(e)


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    if client is None:
        return jsonify({"status": "error", "message": "Client not initialized"}), 500

    return jsonify({
        "status": "ok",
        "client_initialized": True,
        "can_read_account": client.is_configured_for_reading,
        "can_trade": client.is_configured_for_trading,
        "base_url": client.base_url,
        "address_configured": bool(client.address),
        "subaccount_configured": bool(client.subaccount_id),
        "private_key_configured": bool(client.private_key),
        "address": client.address[:10] + "..." if client.address else None,
        "subaccount_id": client.subaccount_id[:10] + "..." if client.subaccount_id else None
    })


# Market Data Endpoints (no authentication required)
@app.route('/products', methods=['GET'])
def get_products():
    """Get list of available trading products."""
    if client is None:
        return jsonify({"error": "Client not initialized"}), 500

    try:
        products = client.get_products()
        return jsonify({"products": serialize_response(products)})
    except Exception as e:
        return handle_error(e)


@app.route('/tokens', methods=['GET'])
def get_tokens():
    """Get list of available tokens."""
    if client is None:
        return jsonify({"error": "Client not initialized"}), 500

    try:
        tokens = client.get_tokens()
        return jsonify({"tokens": serialize_response(tokens)})
    except Exception as e:
        return handle_error(e)


@app.route('/orderbook/<product_id>', methods=['GET'])
def get_order_book(product_id):
    """Get order book for a specific product."""
    if client is None:
        return jsonify({"error": "Client not initialized"}), 500

    try:
        order_book = client.get_order_book(product_id)
        return jsonify({"order_book": order_book})
    except Exception as e:
        return handle_error(e)


@app.route('/market-data/<product_id>', methods=['GET'])
def get_market_data(product_id):
    """Get market data for a specific product."""
    if client is None:
        return jsonify({"error": "Client not initialized"}), 500

    try:
        market_data = client.get_market_data(product_id)
        return jsonify({"market_data": market_data})
    except Exception as e:
        return handle_error(e)


# Account Management Endpoints (require address)
@app.route('/account', methods=['GET'])
def get_account_info():
    """Get account information."""
    if client is None:
        return jsonify({"error": "Client not initialized"}), 500

    try:
        account_info = client.get_account_info()
        return jsonify({"account": account_info})
    except Exception as e:
        return handle_error(e)


@app.route('/balances', methods=['GET'])
def get_balances():
    """Get account balances."""
    if client is None:
        return jsonify({"error": "Client not initialized"}), 500

    try:
        balances = client.get_balances()
        return jsonify({"balances": balances})
    except Exception as e:
        return handle_error(e)


@app.route('/subaccounts', methods=['GET'])
def list_subaccounts():
    """List all subaccounts."""
    if client is None:
        return jsonify({"error": "Client not initialized"}), 500

    try:
        subaccounts = client.list_subaccounts()
        return jsonify({"subaccounts": subaccounts})
    except Exception as e:
        return handle_error(e)


@app.route('/subaccounts/<subaccount_id>', methods=['GET'])
def get_subaccount(subaccount_id):
    """Get details for a specific subaccount."""
    if client is None:
        return jsonify({"error": "Client not initialized"}), 500

    try:
        subaccount = client.get_subaccount(subaccount_id)
        return jsonify({"subaccount": subaccount})
    except Exception as e:
        return handle_error(e)


@app.route('/subaccounts/default', methods=['GET'])
def get_default_subaccount_id():
    """Get default subaccount ID."""
    if client is None:
        return jsonify({"error": "Client not initialized"}), 500

    try:
        default_id = client.get_default_subaccount_id()
        return jsonify({"default_subaccount_id": default_id})
    except Exception as e:
        return handle_error(e)


@app.route('/subaccounts', methods=['POST'])
def create_subaccount():
    """Create a new subaccount."""
    if client is None:
        return jsonify({"error": "Client not initialized"}), 500

    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({"error": "Missing required field: name"}), 400

    try:
        subaccount = client.create_subaccount(data['name'])
        return jsonify({"subaccount": subaccount}), 201
    except Exception as e:
        return handle_error(e)


@app.route('/orders', methods=['GET'])
def list_orders():
    """List orders for a subaccount."""
    if client is None or async_client is None:
        return jsonify({"error": "Client not initialized"}), 500

    # Get query parameters
    subaccount_id = request.args.get('subaccount_id') or client.subaccount_id
    if not subaccount_id:
        return jsonify({"error": "Missing required parameter: subaccount_id (or set ETHEREAL_SUBACCOUNT_ID in .env)"}), 400

    # Collect all supported parameters
    params = {
        'subaccount_id': subaccount_id
    }

    # Add optional parameters if provided
    if request.args.getlist('product_ids'):
        params['product_ids'] = request.args.getlist('product_ids')

    if request.args.get('client_order_id'):
        params['client_order_id'] = request.args.get('client_order_id')

    if request.args.getlist('statuses'):
        params['statuses'] = request.args.getlist('statuses')

    if request.args.get('order'):
        params['order'] = request.args.get('order')

    if request.args.get('limit'):
        params['limit'] = float(request.args.get('limit'))

    if request.args.get('cursor'):
        params['cursor'] = request.args.get('cursor')

    if request.args.get('order_by'):
        params['order_by'] = request.args.get('order_by')

    try:
        # Call the async method using the underlying client
        import asyncio

        # Create a new event loop if none exists
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        # Call the async list_orders method
        orders = loop.run_until_complete(async_client.list_orders(**params))

        return jsonify({"orders": serialize_response(orders)})
    except Exception as e:
        return handle_error(e)


# Trading Endpoints (require private key)
@app.route('/orders', methods=['POST'])
def create_order():
    """Create a new trading order with full parameter support."""
    if client is None or async_client is None:
        return jsonify({"error": "Client not initialized"}), 500

    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    # Check for required fields (at minimum need order_type, quantity, side)
    required_fields = ['order_type', 'quantity', 'side']
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400

    try:
        # Use subaccount from env if not provided in request
        subaccount_id = data.get('subaccount') or client.subaccount_id
        sender = data.get('sender') or client.address

        # Ensure we have required parameters
        if not sender:
            return jsonify({"error": "Sender address is required. Set ETHEREAL_ADDRESS in .env"}), 400
        if not subaccount_id:
            return jsonify({"error": "Subaccount ID is required. Set ETHEREAL_SUBACCOUNT_ID in .env"}), 400

        # Call the underlying SDK create_order method with all possible parameters
        import asyncio

        # Prepare order parameters
        order_params = {
            'order_type': data['order_type'],
            'quantity': data['quantity'],
            'side': data['side'],
            'sender': sender,
            'subaccount': subaccount_id,
            'sign': data.get('sign', True),
            'dry_run': data.get('dry_run', False),
            'submit': data.get('submit', True)
        }

        # Add optional parameters
        optional_params = ['price', 'ticker', 'product_id', 'client_order_id',
                          'time_in_force', 'post_only', 'reduce_only', 'close',
                          'stop_price', 'stop_type', 'expires_at', 'group_id',
                          'group_contingency_type']

        for param in optional_params:
            if param in data and data[param] is not None:
                order_params[param] = data[param]

        print(f"Order parameters: {order_params}")

        # Create a fresh async client for this request to avoid event loop issues
        async def create_order_async():
            fresh_client = await AsyncRESTClient.create(async_client_config)
            return await fresh_client.create_order(**order_params)

        # Create a new event loop for this request
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            order = loop.run_until_complete(create_order_async())
        finally:
            loop.close()

        # Try to serialize the response
        try:
            serialized_order = serialize_response(order)
            return jsonify({"order": serialized_order}), 201
        except Exception as serialization_error:
            # Fallback: return basic info about the order
            print(f"Serialization error: {serialization_error}")
            print(f"Order type: {type(order)}")

            return jsonify({
                "order": {
                    "success": True,
                    "order_type": str(type(order).__name__),
                    "raw_response": str(order)[:1000]  # Truncate to avoid huge responses
                }
            }), 201

    except Exception as e:
        return handle_error(e)


@app.route('/orders/cancel', methods=['POST'])
def cancel_orders():
    """Cancel multiple orders."""
    if client is None:
        return jsonify({"error": "Client not initialized"}), 500

    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    required_fields = ['order_ids', 'subaccount']
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400

    try:
        result = client.cancel_orders(
            order_ids=data['order_ids'],
            subaccount=data['subaccount'],
            client_order_ids=data.get('client_order_ids'),
            sign=data.get('sign', True),
            submit=data.get('submit', True)
        )
        return jsonify({"result": serialize_response(result)})
    except Exception as e:
        return handle_error(e)




@app.route('/api-docs', methods=['GET'])
def api_documentation():
    """Return API documentation."""
    docs = {
        "title": "Ethereal Client API",
        "description": "REST API wrapper for the Ethereal Python SDK",
        "endpoints": {
            "health": {
                "GET /health": "Health check and client status"
            },
            "market_data": {
                "GET /products": "List available trading products",
                "GET /tokens": "List available tokens",
                "GET /orderbook/{product_id}": "Get order book for a product",
                "GET /market-data/{product_id}": "Get market data for a product"
            },
            "account_management": {
                "GET /account": "Get account information",
                "GET /balances": "Get account balances",
                "GET /subaccounts": "List all subaccounts",
                "GET /subaccounts/{id}": "Get subaccount details",
                "GET /subaccounts/default": "Get default subaccount ID",
                "POST /subaccounts": "Create new subaccount",
                "GET /orders": "List orders (requires subaccount_id parameter)"
            },
            "trading": {
                "POST /orders": "Create new order",
                "POST /orders/cancel": "Cancel multiple orders",
                "POST /orders/{id}/cancel": "Cancel single order"
            }
        }
    }
    return jsonify(docs)


if __name__ == '__main__':
    port = 8080
    print("\n🚀 Starting Ethereal API Server...")
    print(f"📖 API Documentation: http://localhost:{port}/api-docs")
    print(f"❤️  Health Check: http://localhost:{port}/health")
    print("🔄 CORS enabled for all origins")

    app.run(host='0.0.0.0', port=port, debug=True)