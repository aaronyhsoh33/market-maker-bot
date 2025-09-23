# 🚀 Market Making Bot - Startup Guide

This guide explains how to start the complete market making bot stack, which consists of:

1. **Python API Proxy Server** - Handles Ethereal API authentication and order routing
2. **TypeScript Market Making Bot** - Core trading logic and market making engine

## 📋 Prerequisites

### System Requirements
- **Node.js** 18+ and npm
- **Python** 3.8+ and pip
- **curl** (for health checks)
- **lsof** (for port management)

### Account Setup
- **Ethereal Account** with configured subaccount
- **Environment Variables** configured in both `.env` files

## ⚡ Quick Start Commands

### Start Everything
```bash
# Start both Python server and TypeScript bot
npm run start:all
```

### Start Individual Services
```bash
# Start only Python API server
npm run start:python

# Start only TypeScript bot (requires Python server running)
npm run start

# Development mode with auto-reload
npm run dev
```

### Management Commands
```bash
# Check service status and health
npm run status

# Stop all services gracefully
npm run stop:all
```

## 🔧 Detailed Setup

### 1. Python API Server Setup

The Python server acts as a proxy for Ethereal API calls, handling authentication and signature requirements.

**Initial Setup:**
```bash
cd market-bot2-python-client

# Create virtual environment (done automatically by scripts)
python3 -m venv venv
source venv/bin/activate

# Install dependencies (done automatically by scripts)
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your Ethereal credentials
```

**Environment Variables (Python `.env`):**
```bash
# Ethereal API Configuration
ETHEREAL_API_KEY=your_api_key_here
ETHEREAL_SECRET_KEY=your_secret_key_here
ETHEREAL_BASE_URL=https://api.etherealtest.net/v1

# Trading Configuration
DEFAULT_SUBACCOUNT_ID=your_subaccount_id_here
```

### 2. TypeScript Bot Setup

The TypeScript bot contains the market making logic and orchestrates all trading operations.

**Configuration:**
```bash
# Configure main environment
cp .env.example .env
# Edit .env with your configuration
```

**Environment Variables (Main `.env`):**
```bash
# Market Making Parameters
QUOTE_REFRESH_CYCLE=1000
SPREAD_WIDTH=10
MAX_PRICE_DEVIATION=5.0
TICKERS=BTCUSD,ETHUSD,SOLUSD

# Ethereal Integration
ETHEREAL_LOCAL_BASE_URL=http://localhost:8080    # Python proxy
ETHEREAL_API_BASE_URL=https://api.etherealtest.net/v1
ETHEREAL_SUBACCOUNT_ID=your-subaccount-id-here
ETHEREAL_SUBACCOUNT=0x7072696d61727900000000000000000000000000000000000000000000000000

# Price Feeds
HERMES_ENDPOINT=https://hermes.pyth.network
```

## 🏃‍♂️ Running the System

### Full Stack Startup

```bash
# This will:
# 1. Start Python API server on port 8080
# 2. Wait for server to be ready
# 3. Build TypeScript bot
# 4. Start market making bot
npm run start:all
```

**Expected Output:**
```
🚀 Starting Market Making Bot Full Stack
==================================================
[INFO] Starting Python API server...
[INFO] Creating Python virtual environment...
[INFO] Installing Python dependencies...
[INFO] Launching Python API server on port 8080...
[SUCCESS] Python API server started successfully (PID: 12345)
[INFO] Waiting 3s for Python server complete initialization...
[INFO] Building TypeScript bot...
[SUCCESS] TypeScript bot built successfully
[INFO] Starting TypeScript market making bot...
[SUCCESS] TypeScript bot started (PID: 67890)

🎉 All services started successfully!
==================================================
Python API Server: http://localhost:8080
API Documentation: http://localhost:8080/api-docs
Health Check: http://localhost:8080/health

Market Making Bot: Running with PID 67890

Press Ctrl+C to stop all services
==================================================
```

### Individual Service Startup

**Python Server Only:**
```bash
npm run start:python
```

**TypeScript Bot Only:**
```bash
# Requires Python server to be running first
npm run build  # Build if needed
npm start      # Start the bot
```

**Development Mode:**
```bash
# Auto-reload on code changes (TypeScript only)
npm run dev
```

## 📊 Monitoring and Health Checks

### Service Status Check
```bash
npm run status
```

**Example Output:**
```
🔍 Checking Market Making Bot Services
==================================================

Checking Python API Server...
[SUCCESS] Python API Server is running on port 8080
  PID: 12345
  Process: python start_server.py
[SUCCESS] Python API Server health check PASSED
  Response: {"status": "healthy", "timestamp": "2024-01-15T10:30:00Z"}

Checking TypeScript Market Bot...
[SUCCESS] TypeScript Market Bot (production) processes found
  PIDs: 67890
  67890  1234 node dist/index.js

🎉 All core services are healthy!

🔗 Service URLs:
  Python API: http://localhost:8080
  API Docs: http://localhost:8080/api-docs
  Health Check: http://localhost:8080/health
```

### Manual Health Checks
```bash
# Python API server health
curl http://localhost:8080/health

# Check available API endpoints
curl http://localhost:8080/api-docs

# View server logs
tail -f market-bot2-python-client/python_server.log
```

## 🛑 Stopping Services

### Graceful Shutdown
```bash
# Stop all services gracefully
npm run stop:all
```

### Manual Shutdown
```bash
# Stop by pressing Ctrl+C in the terminal running start:all
# Or use the stop script

# Kill specific services
lsof -ti:8080 | xargs kill  # Stop Python server
pkill -f "node.*dist/index.js"  # Stop TypeScript bot
```

## 🔧 Troubleshooting

### Common Issues

**Port 8080 Already in Use:**
```bash
# The start scripts will detect and offer to kill existing processes
# Or manually kill:
lsof -ti:8080 | xargs kill -9
```

**Python Dependencies Issues:**
```bash
cd market-bot2-python-client
source venv/bin/activate
pip install --upgrade -r requirements.txt
```

**TypeScript Build Errors:**
```bash
npm install  # Reinstall dependencies
npm run build  # Rebuild
```

**Environment Configuration:**
```bash
# Ensure both .env files are configured:
ls -la .env  # Main project
ls -la market-bot2-python-client/.env  # Python client
```

### Log Files

**Python Server Logs:**
```bash
tail -f market-bot2-python-client/python_server.log
```

**TypeScript Bot Logs:**
- Console output from the terminal running the bot
- Or redirect to file: `npm start > bot.log 2>&1 &`

### Service Dependencies

```
┌─────────────────┐    ┌──────────────────┐
│   TypeScript    │───▶│   Python API     │
│   Market Bot    │    │   Proxy Server   │
│   (Port: any)   │    │   (Port: 8080)   │
└─────────────────┘    └──────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│   Pyth Network  │    │   Ethereal API   │
│   (Hermes)      │    │   (Exchange)     │
│   Price Feeds   │    │   Order Routing  │
└─────────────────┘    └──────────────────┘
```

**Startup Order:**
1. Python API Proxy Server (handles Ethereal authentication)
2. TypeScript Market Making Bot (depends on Python proxy)

**The `start:all` script handles this dependency automatically.**

## 🚨 Production Considerations

### Process Management
For production deployment, consider using process managers:

```bash
# PM2 for Node.js
npm install -g pm2
pm2 start dist/index.js --name market-bot

# Supervisor for Python
# Or Docker containers for both services
```

### Monitoring
- Set up log aggregation
- Configure alerting for service failures
- Monitor API rate limits and performance
- Track trading metrics and PnL

### Security
- Use proper secrets management (not .env files)
- Configure firewalls and network security
- Implement IP whitelisting where possible
- Regular security updates for dependencies