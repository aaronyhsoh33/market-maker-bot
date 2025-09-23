#!/bin/bash

# Market Making Bot - Full Stack Startup Script
# Starts Python API proxy server and TypeScript market making bot

set -e  # Exit on any error

# Configuration
PYTHON_CLIENT_DIR="market-bot2-python-client"
PYTHON_PORT=8080
BOT_BUILD_REQUIRED=true
STARTUP_DELAY=3  # seconds to wait for Python server startup

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

# Cleanup function for graceful shutdown
cleanup() {
    log_info "Shutting down services..."

    # Kill Python server if it's running
    if [[ ! -z "$PYTHON_PID" ]]; then
        log_info "Stopping Python API server (PID: $PYTHON_PID)"
        kill $PYTHON_PID 2>/dev/null || true
        wait $PYTHON_PID 2>/dev/null || true
    fi

    # Kill TypeScript bot if it's running
    if [[ ! -z "$BOT_PID" ]]; then
        log_info "Stopping TypeScript bot (PID: $BOT_PID)"
        kill $BOT_PID 2>/dev/null || true
        wait $BOT_PID 2>/dev/null || true
    fi

    log_success "All services stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1

    log_info "Waiting for $service_name to be ready..."

    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" >/dev/null 2>&1; then
            log_success "$service_name is ready!"
            return 0
        fi

        echo -n "."
        sleep 1
        attempt=$((attempt + 1))
    done

    log_error "$service_name failed to start within $max_attempts seconds"
    return 1
}

# Function to start Python API server
start_python_server() {
    log_info "Starting Python API server..."

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
    pip install -r requirements.txt >/dev/null 2>&1

    # Check if .env file exists
    if [[ ! -f ".env" ]]; then
        log_warning "Python client .env file not found"
        if [[ -f ".env.example" ]]; then
            log_info "Copying .env.example to .env"
            cp .env.example .env
            log_warning "Please configure .env file in $PYTHON_CLIENT_DIR before starting"
        fi
    fi

    # Start Python server in background
    log_info "Launching Python API server on port $PYTHON_PORT..."
    python start_server.py > python_server.log 2>&1 &
    PYTHON_PID=$!

    # Return to main directory
    cd ..

    # Wait for Python server to be ready
    if wait_for_service "http://localhost:$PYTHON_PORT/health" "Python API server"; then
        log_success "Python API server started successfully (PID: $PYTHON_PID)"
    else
        log_error "Python API server failed to start"
        cleanup
        exit 1
    fi
}

# Function to build TypeScript bot
build_bot() {
    if [[ "$BOT_BUILD_REQUIRED" == "true" ]]; then
        log_info "Building TypeScript bot..."

        # Install dependencies if node_modules doesn't exist
        if [[ ! -d "node_modules" ]]; then
            log_info "Installing Node.js dependencies..."
            npm install
        fi

        # Build the project
        npm run build

        if [[ $? -eq 0 ]]; then
            log_success "TypeScript bot built successfully"
        else
            log_error "Failed to build TypeScript bot"
            cleanup
            exit 1
        fi
    fi
}

# Function to start TypeScript bot
start_bot() {
    log_info "Starting TypeScript market making bot..."

    # Check if .env file exists
    if [[ ! -f ".env" ]]; then
        log_warning "Main .env file not found"
        if [[ -f ".env.example" ]]; then
            log_info "Copying .env.example to .env"
            cp .env.example .env
            log_warning "Please configure .env file before starting the bot"
        fi
    fi

    # Start the bot
    npm start &
    BOT_PID=$!

    log_success "TypeScript bot started (PID: $BOT_PID)"
}

# Main execution
main() {
    log_info "🚀 Starting Market Making Bot Full Stack"
    echo "=================================================="

    # Step 1: Start Python API server
    start_python_server

    # Step 2: Wait a moment for complete initialization
    log_info "Waiting ${STARTUP_DELAY}s for Python server complete initialization..."
    sleep $STARTUP_DELAY

    # Step 3: Build TypeScript bot
    build_bot

    # Step 4: Start TypeScript bot
    start_bot

    # Show status
    echo ""
    log_success "🎉 All services started successfully!"
    echo "=================================================="
    log_info "Python API Server: http://localhost:$PYTHON_PORT"
    log_info "API Documentation: http://localhost:$PYTHON_PORT/api-docs"
    log_info "Health Check: http://localhost:$PYTHON_PORT/health"
    echo ""
    log_info "Market Making Bot: Running with PID $BOT_PID"
    echo ""
    log_info "Log files:"
    log_info "  Python server: $PYTHON_CLIENT_DIR/python_server.log"
    echo ""
    log_warning "Press Ctrl+C to stop all services"
    echo "=================================================="

    # Wait for services to run
    wait
}

# Execute main function
main "$@"