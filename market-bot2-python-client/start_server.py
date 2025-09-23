#!/usr/bin/env python3
"""
Ethereal API Server Startup Script

This script starts the Flask API server and provides helpful information
about available endpoints for testing with Postman.
"""

import os
import sys
from api_server import app, client

def print_server_info():
    """Print server startup information and API endpoints."""
    print("\n" + "="*60)
    print("🚀 ETHEREAL API SERVER")
    print("="*60)

    port = 8080
    print(f"\n📍 Server URL: http://localhost:{port}")
    print(f"📖 API Documentation: http://localhost:{port}/api-docs")
    print(f"❤️  Health Check: http://localhost:{port}/health")

    if client:
        print(f"\n⚙️  CLIENT STATUS:")
        print(f"   Base URL: {client.base_url}")
        print(f"   Can read account: {client.is_configured_for_reading}")
        print(f"   Can trade: {client.is_configured_for_trading}")
    else:
        print(f"\n❌ CLIENT NOT INITIALIZED - Check your .env file")

    print(f"\n📡 API ENDPOINTS FOR POSTMAN:")
    print(f"   Market Data (No Auth Required):")
    print(f"   • GET  /products")
    print(f"   • GET  /tokens")
    print(f"   • GET  /orderbook/{{product_id}}")
    print(f"   • GET  /market-data/{{product_id}}")

    print(f"\n   Account Management (Requires Address):")
    print(f"   • GET  /account")
    print(f"   • GET  /balances")
    print(f"   • GET  /subaccounts")
    print(f"   • GET  /subaccounts/{{id}}")
    print(f"   • GET  /subaccounts/default")
    print(f"   • POST /subaccounts")
    print(f"   • GET  /orders?subaccount_id={{id}}")

    print(f"\n   Trading (Requires Private Key):")
    print(f"   • POST /orders")
    print(f"   • POST /orders/cancel")
    print(f"   • POST /orders/{{id}}/cancel")

    print(f"\n📝 EXAMPLE POSTMAN REQUESTS:")
    print(f"   Health Check:")
    print(f"   GET http://localhost:{port}/health")

    print(f"\n   Get Products:")
    print(f"   GET http://localhost:{port}/products")

    print(f"\n   Create Order:")
    print(f"   POST http://localhost:{port}/orders")
    print(f"   Body (JSON): {{")
    print(f"     \"ticker\": \"BTCUSD\",")
    print(f"     \"side\": \"buy\",")
    print(f"     \"quantity\": 0.001,")
    print(f"     \"order_type\": \"LIMIT\",")
    print(f"     \"price\": 30000.0")
    print(f"   }}")

    print("\n" + "="*60)
    print("🔥 Server starting... Press Ctrl+C to stop")
    print("="*60 + "\n")


def main():
    """Main startup function."""

    # Check if .env file exists
    if not os.path.exists('.env'):
        print("⚠️  Warning: .env file not found!")
        print("   Copy .env.example to .env and configure your credentials")
        print("   Some endpoints may not work without proper configuration")

    # Print server information
    print_server_info()

    try:
        # Start the Flask server
        port = 8080
        app.run(host='0.0.0.0', port=port, debug=True)
    except KeyboardInterrupt:
        print("\n👋 Server stopped by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Server error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()