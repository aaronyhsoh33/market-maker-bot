#!/bin/bash

# Python API Server Startup Script
# Starts only the Python API proxy server

set -e  # Exit on any error

# Configuration
PYTHON_CLIENT_DIR="market-bot2-python-client"
PYTHON_PORT=8080

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

# Cleanup function
cleanup() {
    log_info "Stopping Python API server..."
    exit 0
}

trap cleanup SIGINT SIGTERM

# Check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Main function
main() {
    log_info "🐍 Starting Python API Server"
    echo "=================================================="

    # Check if Python client directory exists
    if [[ ! -d "$PYTHON_CLIENT_DIR" ]]; then
        log_error "Python client directory '$PYTHON_CLIENT_DIR' not found"
        exit 1
    fi

    # Check if port is already in use
    if check_port $PYTHON_PORT; then
        log_warning "Port $PYTHON_PORT is already in use"
        read -p "Kill existing process and continue? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "Killing process on port $PYTHON_PORT"
            lsof -ti:$PYTHON_PORT | xargs kill -9 2>/dev/null || true
            sleep 2
        else
            log_error "Cannot start - port $PYTHON_PORT is occupied"
            exit 1
        fi
    fi

    # Navigate to Python client directory
    cd "$PYTHON_CLIENT_DIR"

    # Check if virtual environment exists
    if [[ ! -d "venv" ]]; then
        log_info "Creating Python virtual environment..."
        python3 -m venv venv
    fi

    # Activate virtual environment
    source venv/bin/activate

    # Install/update requirements
    log_info "Installing Python dependencies..."
    pip install -r requirements.txt

    # Check if .env file exists
    if [[ ! -f ".env" ]]; then
        log_warning "Python client .env file not found"
        if [[ -f ".env.example" ]]; then
            log_info "Copying .env.example to .env"
            cp .env.example .env
            log_warning "Please configure .env file before using all features"
        fi
    fi

    # Start Python server
    log_success "🚀 Starting Python API server on port $PYTHON_PORT"
    echo "=================================================="
    log_info "API Server: http://localhost:$PYTHON_PORT"
    log_info "API Documentation: http://localhost:$PYTHON_PORT/api-docs"
    log_info "Health Check: http://localhost:$PYTHON_PORT/health"
    echo ""
    log_warning "Press Ctrl+C to stop the server"
    echo "=================================================="

    python start_server.py
}

# Execute main function
main "$@"