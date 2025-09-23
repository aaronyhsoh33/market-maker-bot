#!/bin/bash

# Stop All Services Script
# Stops Python API server and TypeScript bot gracefully

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to stop processes on a specific port
stop_port() {
    local port=$1
    local service_name=$2

    local pids=$(lsof -ti:$port 2>/dev/null)

    if [[ ! -z "$pids" ]]; then
        log_info "Stopping $service_name on port $port..."
        echo $pids | xargs kill -TERM 2>/dev/null || true

        # Wait a moment for graceful shutdown
        sleep 2

        # Force kill if still running
        local remaining_pids=$(lsof -ti:$port 2>/dev/null)
        if [[ ! -z "$remaining_pids" ]]; then
            log_warning "Force killing $service_name processes..."
            echo $remaining_pids | xargs kill -9 2>/dev/null || true
        fi

        log_success "$service_name stopped"
    else
        log_info "No $service_name processes found on port $port"
    fi
}

# Function to stop processes by name pattern
stop_by_name() {
    local pattern=$1
    local service_name=$2

    local pids=$(pgrep -f "$pattern" 2>/dev/null)

    if [[ ! -z "$pids" ]]; then
        log_info "Stopping $service_name processes..."
        echo $pids | xargs kill -TERM 2>/dev/null || true

        # Wait a moment for graceful shutdown
        sleep 2

        # Force kill if still running
        local remaining_pids=$(pgrep -f "$pattern" 2>/dev/null)
        if [[ ! -z "$remaining_pids" ]]; then
            log_warning "Force killing $service_name processes..."
            echo $remaining_pids | xargs kill -9 2>/dev/null || true
        fi

        log_success "$service_name stopped"
    else
        log_info "No $service_name processes found"
    fi
}

main() {
    log_info "🛑 Stopping Market Making Bot Services"
    echo "=================================================="

    # Stop Python API server (port 8080)
    stop_port 8080 "Python API Server"

    # Stop Node.js processes (market bot)
    stop_by_name "node.*dist/index.js" "TypeScript Market Bot"
    stop_by_name "ts-node.*src/index.ts" "TypeScript Market Bot (dev)"

    # Stop any Flask processes related to our API server
    stop_by_name "python.*start_server.py" "Python API Server"
    stop_by_name "python.*api_server.py" "Python API Server"

    echo ""
    log_success "🎉 All services stopped!"

    # Show any remaining processes that might be related
    echo ""
    log_info "Checking for any remaining related processes..."

    if pgrep -f "market-bot" >/dev/null 2>&1; then
        log_warning "Found remaining market-bot processes:"
        pgrep -fl "market-bot"
    fi

    if lsof -i:8080 >/dev/null 2>&1; then
        log_warning "Port 8080 still in use:"
        lsof -i:8080
    fi

    echo "=================================================="
}

main "$@"