#!/bin/bash

# Service Health Check Script
# Checks the status of Python API server and TypeScript bot

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

# Function to check if port is in use
check_port() {
    local port=$1
    local service_name=$2

    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_success "$service_name is running on port $port"

        # Try to get process info
        local pid=$(lsof -ti:$port 2>/dev/null | head -1)
        if [[ ! -z "$pid" ]]; then
            local process_info=$(ps -p $pid -o pid,ppid,cmd --no-headers 2>/dev/null)
            echo "  PID: $pid"
            echo "  Process: $(echo $process_info | cut -d' ' -f3-)"
        fi

        return 0
    else
        log_error "$service_name is NOT running on port $port"
        return 1
    fi
}

# Function to check HTTP service health
check_http_health() {
    local url=$1
    local service_name=$2

    if curl -s -f "$url" >/dev/null 2>&1; then
        log_success "$service_name health check PASSED"

        # Try to get response details
        local response=$(curl -s "$url" 2>/dev/null)
        if [[ ! -z "$response" ]]; then
            echo "  Response: $(echo $response | jq -r '.status // .message // .' 2>/dev/null || echo $response | head -c 100)"
        fi

        return 0
    else
        log_error "$service_name health check FAILED"
        return 1
    fi
}

# Function to check process by pattern
check_process() {
    local pattern=$1
    local service_name=$2

    local pids=$(pgrep -f "$pattern" 2>/dev/null)

    if [[ ! -z "$pids" ]]; then
        log_success "$service_name processes found"
        echo "  PIDs: $pids"

        # Show process details
        for pid in $pids; do
            local process_info=$(ps -p $pid -o pid,ppid,cmd --no-headers 2>/dev/null)
            if [[ ! -z "$process_info" ]]; then
                echo "  $process_info"
            fi
        done

        return 0
    else
        log_error "No $service_name processes found"
        return 1
    fi
}

main() {
    log_info "🔍 Checking Market Making Bot Services"
    echo "=================================================="

    local all_healthy=true

    # Check Python API Server
    echo ""
    log_info "Checking Python API Server..."
    if ! check_port 8080 "Python API Server"; then
        all_healthy=false
    else
        if ! check_http_health "http://localhost:8080/health" "Python API Server"; then
            all_healthy=false
        fi
    fi

    # Check TypeScript Bot processes
    echo ""
    log_info "Checking TypeScript Market Bot..."
    if ! check_process "node.*dist/index.js" "TypeScript Market Bot (production)"; then
        if ! check_process "ts-node.*src/index.ts" "TypeScript Market Bot (development)"; then
            all_healthy=false
        fi
    fi

    # Check for any Python server processes
    echo ""
    log_info "Checking Python processes..."
    check_process "python.*start_server.py" "Python Server"

    # Overall status
    echo ""
    echo "=================================================="
    if [[ "$all_healthy" == "true" ]]; then
        log_success "🎉 All core services are healthy!"
    else
        log_error "❌ Some services are not running"
        echo ""
        log_info "To start services:"
        log_info "  Full stack: npm run start:all"
        log_info "  Python only: npm run start:python"
        log_info "  TypeScript only: npm start"
    fi

    # Show service URLs
    echo ""
    log_info "🔗 Service URLs:"
    log_info "  Python API: http://localhost:8080"
    log_info "  API Docs: http://localhost:8080/api-docs"
    log_info "  Health Check: http://localhost:8080/health"

    echo "=================================================="

    # Additional network checks
    echo ""
    log_info "📡 Network Status:"

    # Check if we can reach external services
    if curl -s --max-time 5 "https://hermes.pyth.network" >/dev/null 2>&1; then
        log_success "Pyth Hermes endpoint reachable"
    else
        log_warning "Pyth Hermes endpoint not reachable"
    fi

    if curl -s --max-time 5 "https://api.etherealtest.net/v1" >/dev/null 2>&1; then
        log_success "Ethereal API endpoint reachable"
    else
        log_warning "Ethereal API endpoint not reachable"
    fi

    echo "=================================================="
}

main "$@"