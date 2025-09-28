# Market Making Bot (mm-bot3)

A high-frequency market making bot for perpetual futures DEX platforms, built for technical assessment and production trading operations. The bot provides automated liquidity by maintaining continuous bid and ask orders across multiple trading pairs while managing risk through real-time price monitoring and position awareness.

## 🎯 Overview

This market making bot is designed for **Ethereal**, a perpetual futures decentralized exchange, with a modular architecture that supports integration with other DEX platforms. The bot maintains competitive spreads, minimizes price drift, and provides configurable risk management across multiple cryptocurrency trading pairs.

> **🚀 Direct API Integration**: This implementation uses direct Ethereal API integration with EIP-712 signature generation, eliminating the need for external proxy services. The bot handles all cryptographic operations natively in TypeScript, providing better performance and simplified deployment.

### Key Features

- **Direct API Integration**: Native Ethereal API integration with EIP-712 signature generation
- **Real-time Price Feeds**: Integrates with Pyth Network via Hermes for sub-second price updates
- **Multi-Asset Support**: Simultaneous market making across BTC/USD, ETH/USD, SOL/USD and configurable pairs
- **Position Awareness**: Automatically accounts for existing positions to prevent over-exposure
- **Risk Management**: Automated order cancellation when prices deviate beyond configured thresholds
- **High-Frequency Operations**: Sub-second quote refresh cycles with concurrency control
- **Graceful Shutdown**: Automatically cancels all active orders during termination
- **Interface-Based Architecture**: Pluggable design for supporting multiple exchanges

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Ethereal Account** with subaccount configuration
- **Private Key** for EIP-712 signature generation
- **Environment Variables** configured (see Configuration section)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd market-bot3

# Install dependencies
npm install

# Build the project
npm run build
```

### Configuration

The bot requires configuration through environment variables:

```bash
# Copy the example environment file
cp .env.example .env

# Edit with your configuration
nano .env
```

### 🎯 Starting the Bot

```bash
# Start the market making bot
npm start

# Development mode with auto-reload
npm run dev

# Check service health and status
npm run status
```

## ⚙️ Configuration

### Environment Variables

#### **Market Making Parameters**

```bash
# Quote refresh frequency (milliseconds)
QUOTE_REFRESH_CYCLE=1000

# Global defaults (can be overridden per asset)
SPREAD_WIDTH=10                    # Spread in basis points (10 bp = 0.1%)
MAX_PRICE_DEVIATION=5.0           # Maximum price deviation % before cancellation

# Trading pairs to monitor
TICKERS=BTCUSD,ETHUSD,SOLUSD
```

#### **Asset-Specific Configuration**

Override global settings for individual assets using the pattern `{TICKER}_USD_{SETTING}`:

```bash
# Bitcoin configuration
BTC_USD_ORDER_SIZE=0.001          # Order quantity in BTC
BTC_USD_SPREAD_WIDTH=8            # Tighter spread for BTC (8 bp)
BTC_USD_MAX_PRICE_DEVIATION=3.0   # Lower deviation threshold

# Ethereum configuration
ETH_USD_ORDER_SIZE=0.01           # Order quantity in ETH
ETH_USD_SPREAD_WIDTH=12           # Wider spread for ETH (12 bp)

# Solana configuration
SOL_USD_ORDER_SIZE=1.0            # Order quantity in SOL
SOL_USD_SPREAD_WIDTH=15           # Widest spread for SOL (15 bp)
```

#### **Ethereal Exchange Configuration**

```bash
# Ethereal API endpoints
ETHEREAL_API_BASE_URL=https://api.etherealtest.net/v1  # Direct API access
ETHEREAL_WS_URL=wss://ws.etherealtest.net/v1/stream    # WebSocket endpoint
ETHEREAL_TIMEOUT=10000                           # Request timeout (ms)

# Account configuration
ETHEREAL_SUBACCOUNT_ID=your-subaccount-id-here   # Your subaccount UUID
ETHEREAL_SUBACCOUNT=0x7072696d61727900000000000000000000000000000000000000000000000000  # Hex-encoded subaccount
ETHEREAL_PRIVATE_KEY=your-private-key-here       # Private key for EIP-712 signatures
```

#### **Price Feed Configuration**

```bash
# Hermes configuration (Pyth Network)
HERMES_ENDPOINT=https://hermes.pyth.network
```

### Configuration Examples

#### Conservative Setup (Lower Risk)
```bash
QUOTE_REFRESH_CYCLE=2000          # Slower refresh (2 seconds)
SPREAD_WIDTH=20                   # Wider spreads
MAX_PRICE_DEVIATION=2.0           # Tight deviation control
BTC_USD_ORDER_SIZE=0.0001         # Smaller position sizes
```

#### Aggressive Setup (Higher Frequency)
```bash
QUOTE_REFRESH_CYCLE=500           # Fast refresh (0.5 seconds)
SPREAD_WIDTH=5                    # Tight spreads
MAX_PRICE_DEVIATION=10.0          # Allow more price movement
BTC_USD_ORDER_SIZE=0.01           # Larger position sizes
```

## 🏗️ Architecture

### System Overview

The market making bot uses a streamlined TypeScript-only architecture with direct API integration:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Market Making Bot System                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                TypeScript Market Bot                        │ │
│  │              (Core Logic + API Integration)                 │ │
│  │                                                             │ │
│  │  ┌─────────────────┐    ┌──────────────────┐               │ │
│  │  │ Price Feeds     │    │ Ethereal DEX     │               │ │
│  │  │ (Pyth/Hermes)   │    │ Trading API      │               │ │
│  │  │                 │    │ (Direct EIP-712) │               │ │
│  │  └─────────────────┘    └──────────────────┘               │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Core Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Price Feeds   │    │   Market Making  │    │   Exchange      │
│                 │    │     Engine       │    │   Integration   │
│ HermesPriceClient│───▶│PriceSnapshotService│◀──│ EtherealService │
│ (Pyth Network)  │    │                  │    │ (Direct API)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │                          │
                              ▼                          ▼
                    ┌──────────────────┐    ┌──────────────────┐
                    │ Risk Management  │    │  Real-time       │
                    │                  │    │  Updates         │
                    │DeviationCheckSvc │    │EtherealWSClient  │
                    └──────────────────┘    └──────────────────┘
```

### Service Responsibilities

- **PriceSnapshotService**: Core orchestration, order management, position tracking
- **HermesPriceClient**: Real-time price feeds from Pyth Network via Hermes
- **EtherealService**: Direct order execution and account management on Ethereal DEX with EIP-712 signatures
- **EtherealWebSocketClient**: Real-time order status and fill notifications
- **DeviationCheckService**: Risk management and price deviation monitoring

### Trading Logic Flow

1. **Price Updates**: Receive real-time prices from Pyth Network
2. **Market Analysis**: Calculate optimal bid/ask prices with configured spreads
3. **Order Management**: Create/cancel orders based on market conditions
4. **Risk Monitoring**: Continuously check for price deviations and position limits
5. **Position Integration**: Account for existing positions in order placement decisions

## 🔄 Development Workflow

### Recommended Development Process

**1. Initial Setup:**
```bash
# Clone and setup the project
git clone <repository-url>
cd market-bot3
npm install
```

**2. Configure Both Components:**
```bash
# Main application config
cp .env.example .env
nano .env

```

**3. Development Mode:**
```bash
# Develop with auto-reload
npm run dev

# Monitor service health
watch -n 5 npm run status
```

**4. Testing:**
```bash
# Run comprehensive test suite
npm test

# Run with coverage
npm test -- --coverage

# Test specific components
npm test -- tests/services/PriceSnapshotService.test.ts
```

**5. Production Deployment:**
```bash
# Build and start everything
npm run build
npm run start:all

```

### 🚀 Quick Development Commands

```bash
# Development essentials
npm run dev           # TypeScript auto-reload
npm run status        # Health check

# Testing and validation
npm test             # Unit tests
npm run build        # Production build
npm start            # Start the bot
```

## 📊 Monitoring and Operations

### Startup Sequence Logging

When starting the bot, you'll see this startup sequence:

```bash
🚀 Starting Market Making Bot
==================================================
[INFO] Building TypeScript bot...
[SUCCESS] TypeScript bot built successfully
[INFO] Starting TypeScript market making bot...
[SUCCESS] TypeScript bot started (PID: 67890)

🎉 Market Making Bot started successfully!
==================================================
Market Making Bot: Running with PID 67890
==================================================
```

### Runtime Logging Output

The bot provides detailed logging for monitoring performance:

```bash
Starting Market Making Bot...
Connected to Hermes WebSocket
Subscribed to price feeds: BTCUSD, ETHUSD, SOLUSD
Connected to Ethereal WebSocket
Fetching existing positions...
[BTCUSD] Found existing LONG position: 0.005 @ $45250.00 (treating as filled bid)
Starting quote refresh cycle...
Taking snapshot at 2024-01-15T10:30:15.123Z, 3 price(s) available
[BTCUSD] Creating ask order at $45275.50 for 0.001
[ETHUSD] Creating bid order at $2847.20 for 0.01
[ETHUSD] Creating ask order at $2849.80 for 0.01
```

### Service Status Monitoring

```bash
# Check service health
npm run status

# Example healthy output:
🔍 Checking Market Making Bot Services
==================================================
✅ TypeScript Market Bot processes found
✅ Ethereal API connectivity verified
🎉 Market making bot is healthy!
```

### Key Metrics to Monitor

- **Order Fill Rate**: Percentage of orders that get filled
- **Spread Capture**: Average spread captured per trade
- **Position Balance**: Net position across all trading pairs
- **Risk Events**: Frequency of deviation-based cancellations
- **Latency**: Time from price update to order placement

### Health Checks

The bot includes built-in health monitoring:

- **Price Feed Status**: Hermes connection health
- **Exchange Connectivity**: Ethereal API and WebSocket status
- **Order Execution**: Success rate of order placement/cancellation
- **Position Sync**: Accuracy of position tracking

## 🔧 Development

### Project Structure

```
src/
├── config/           # Configuration management
│   ├── marketConfig.ts      # Environment variable parsing
│   └── priceFeeds.ts        # Pyth price feed mappings
├── interfaces/       # Abstraction interfaces
│   ├── IPriceClient.ts      # Price feed client interface
│   ├── IOrderService.ts     # Order execution interface
│   └── IOrderUpdateClient.ts # WebSocket client interface
├── services/         # Core business logic
│   ├── PriceSnapshotService.ts    # Main orchestration engine
│   ├── HermesPriceClient.ts       # Pyth price feed client
│   ├── EtherealService.ts         # Exchange integration
│   ├── EtherealWebSocketClient.ts # Real-time order updates
│   └── DeviationCheckService.ts   # Risk management
├── types/           # TypeScript type definitions
│   ├── marketMaker.ts       # Core domain types
│   ├── price.ts             # Price feed types
│   ├── orders.ts            # Order management types
│   └── orderUpdates.ts      # WebSocket event types
├── utils/           # Utility functions
│   ├── priceUtils.ts        # Price calculations
│   └── orderUtils.ts        # Order utilities
└── examples/        # Example implementations
    └── snapshotExample.ts   # Price monitoring example
```

### Building and Testing

```bash
# Build TypeScript
npm run build

# Run type checking
npm run type-check

# Run the price monitoring example
npm run example:snapshot

# Clean build artifacts
npm run clean
```

#### Running Tests

The project includes comprehensive unit tests with 65%+ code coverage:

```bash
# Run all tests
npm test

# Run tests with coverage report
npm test -- --coverage

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- tests/services/PriceSnapshotService.test.ts

# Run tests for specific service
npm test -- tests/services/

# Run tests with verbose output
npm test -- --verbose
```

#### Test Coverage

The test suite covers critical market making functionality:

- **Utils (100% coverage)**: Price calculations, order utilities, basis points conversions
- **Config (100% coverage)**: Environment parsing, asset configuration, API setup
- **Services**: Core business logic with comprehensive mocking
  - **PriceSnapshotService (69.6%)**: Main orchestration engine with timer and order management
  - **EtherealService (65.78%)**: Exchange integration with API mocking
  - **DeviationCheckService (100%)**: Risk management calculations
  - **HermesPriceClient (68.18%)**: Price feed integration

#### Test Categories

**Unit Tests:**
- Mathematical calculations (spreads, basis points, deviations)
- Business logic with mocked external dependencies
- Configuration parsing and validation
- Order lifecycle management
- Risk management algorithms

**Mocked External Services:**
- Ethereal API calls (order placement, cancellation, position fetching)
- Pyth Network price feeds via Hermes
- WebSocket connections (for unit testing only)

**Integration Tests:**
- WebSocket real-time updates (separate from unit tests)
- End-to-end price feed workflows
- Complete market making cycles

#### Example Test Commands

```bash
# Check math calculations
npm test -- tests/utils/priceUtils.test.ts

# Test market making logic
npm test -- tests/services/PriceSnapshotService.test.ts

# Test exchange integration
npm test -- tests/services/EtherealService.test.ts

# Test risk management
npm test -- tests/services/DeviationCheckService.test.ts

# Generate coverage report
npm test -- --coverage --coverageDirectory=coverage
```

### Adding New Exchanges

The bot's interface-based architecture makes it easy to add new exchanges:

1. **Implement Interfaces**: Create new classes implementing `IOrderService` and `IOrderUpdateClient`
2. **Add Configuration**: Extend `marketConfig.ts` with exchange-specific settings
3. **Update Initialization**: Modify `index.ts` to use the new exchange services

Example:
```typescript
// New exchange implementation
export class NewExchangeService implements IOrderService {
  async placeOrder(request: CreateOrderRequest): Promise<OrderResponse> {
    // Exchange-specific implementation
  }
}
```

## 🔒 Security Considerations

### API Key Management
- Store all credentials in environment variables
- Use separate subaccounts for testing vs production
- Implement IP whitelisting where supported

### Risk Management
- Set conservative position limits initially
- Monitor for unusual market conditions
- Implement circuit breakers for extreme scenarios

### Network Security
- Use secure WebSocket connections (WSS)
- Validate all incoming data
- Implement request rate limiting

## 🚨 Troubleshooting

### Startup Issues

**"Port 8080 already in use" Error:**
```bash
# The start:all script will detect this and offer to kill existing processes
# Or manually resolve:
npm run stop:all
# Or kill specific process:
lsof -ti:8080 | xargs kill -9
```

**Dependencies Issues:**
```bash
# Clean and reinstall Node.js dependencies
rm -rf node_modules package-lock.json
npm install
```

**TypeScript Build Errors:**
```bash
# Clean and rebuild
rm -rf node_modules dist
npm install
npm run build
```

**Environment Configuration Issues:**
```bash
# Ensure .env file exists and is configured
ls -la .env                              # Main config

# Check example file if needed
cat .env.example
```

**Services Won't Start:**
```bash
# Check what's using relevant ports
lsof -i:8080
netstat -tulpn | grep 8080

# Check system resources
df -h        # Disk space
free -m      # Memory
ps aux       # Running processes
```

### Runtime Issues

**Bot not creating orders:**
- Check Ethereal subaccount configuration
- Verify price feed connectivity with `npm run status`
- Ensure sufficient account balance
- Check Ethereal API connectivity: `curl -s https://api.etherealtest.net/v1/health`

**Orders getting rejected:**
- Verify tick size compliance (prices must be multiples of tickSize)
- Check minimum quantity requirements
- Confirm order expiration times are valid
- Review bot logs for detailed error messages

**High cancellation rate:**
- Increase `MAX_PRICE_DEVIATION` threshold
- Adjust `QUOTE_REFRESH_CYCLE` for less frequent updates
- Review spread width configuration

**Position sync issues:**
- Restart bot to reload positions from exchange: `npm run stop:all && npm run start:all`
- Check product ID mapping in configuration
- Verify subaccount permissions

**Connection Issues:**
```bash
# Test external connectivity
curl -s https://hermes.pyth.network  # Pyth price feeds
curl -s https://api.etherealtest.net/v1  # Ethereal API

# Check external services
curl -s https://api.etherealtest.net/v1/health  # Ethereal API health
```

### Service Recovery

**Complete Reset:**
```bash
# Stop everything
npm run stop:all

# Clean up any orphaned processes
pkill -f "node.*dist/index"

# Clean build artifacts
rm -rf dist node_modules

# Fresh installation
npm install
npm run start:all
```

**Logs and Debugging:**
```bash
# Run TypeScript in debug mode
DEBUG=* npm run dev

# Check service status
npm run status
```

### Error Recovery

The bot includes automatic recovery mechanisms:
- **Price Feed Reconnection**: Automatic reconnection with exponential backoff
- **Order Cleanup**: Cancels all orders on unexpected shutdown
- **Position Reload**: Fetches existing positions on startup
- **Health Monitoring**: Continuous monitoring of all service connections

## 🤝 Support

For technical questions or issues:
1. Check the troubleshooting section above
2. Review the extensive code documentation
3. Examine the example implementations in `/src/examples/`
4. Create an issue with detailed error logs and configuration