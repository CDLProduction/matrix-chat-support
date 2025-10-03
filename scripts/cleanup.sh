#!/bin/bash

# Matrix Chat Support - Complete Cleanup Script
# This script removes all Docker containers, volumes, data, and configuration
# to allow a completely fresh installation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo ""
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}  Matrix Chat Support - Complete Cleanup${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_header

# Confirm cleanup
echo -e "${YELLOW}WARNING: This will remove ALL data and containers!${NC}"
echo ""
echo "This script will:"
echo "  • Stop and remove all Docker containers"
echo "  • Remove all Docker volumes (database data will be lost)"
echo "  • Remove all Docker networks"
echo "  • Delete data/ directory"
echo "  • Delete install-session.json"
echo "  • Delete docker-compose.override.yml"
echo "  • Kill any processes using ports 8008, 8080, 8081"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo ""
print_step "Starting complete cleanup..."
echo ""

# Determine compose command
if command -v docker &> /dev/null && docker compose version &> /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    print_warning "Docker Compose not found, skipping container cleanup"
    COMPOSE_CMD=""
fi

# 1. Stop and remove all containers
if [ -n "$COMPOSE_CMD" ]; then
    print_step "Stopping and removing Docker containers..."
    $COMPOSE_CMD down -v --remove-orphans 2>/dev/null || true
    print_success "Containers stopped and removed"
else
    print_warning "Skipping container cleanup (Docker Compose not available)"
fi

# 2. Remove specific containers by name (in case compose didn't catch them)
if command -v docker &> /dev/null; then
    print_step "Removing containers by name..."

    containers=("matrix-synapse" "postgres" "mautrix-telegram" "synapse-admin" "element")

    for container in "${containers[@]}"; do
        if docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
            docker stop "$container" 2>/dev/null || true
            docker rm -f "$container" 2>/dev/null || true
            print_success "Removed container: $container"
        fi
    done
fi

# 3. Remove volumes
if command -v docker &> /dev/null; then
    print_step "Removing Docker volumes..."

    volumes=$(docker volume ls --format '{{.Name}}' | grep -E '(postgres_data|matrix|synapse)' || true)

    if [ -n "$volumes" ]; then
        echo "$volumes" | xargs docker volume rm -f 2>/dev/null || true
        print_success "Volumes removed"
    else
        print_success "No volumes to remove"
    fi
fi

# 4. Remove networks
if command -v docker &> /dev/null; then
    print_step "Removing Docker networks..."

    networks=$(docker network ls --format '{{.Name}}' | grep -E '(synapse_net|matrix)' || true)

    if [ -n "$networks" ]; then
        echo "$networks" | xargs docker network rm 2>/dev/null || true
        print_success "Networks removed"
    else
        print_success "No networks to remove"
    fi
fi

# 5. Kill processes using common ports
print_step "Checking for processes using ports 8008, 8080, 8081..."

for port in 8008 8080 8081; do
    if command -v lsof &> /dev/null; then
        pid=$(lsof -ti:$port 2>/dev/null || true)
        if [ -n "$pid" ]; then
            kill -9 $pid 2>/dev/null || true
            print_success "Killed process on port $port (PID: $pid)"
        fi
    elif command -v fuser &> /dev/null; then
        fuser -k ${port}/tcp 2>/dev/null || true
        print_success "Killed process on port $port"
    fi
done

# 6. Remove data directory
print_step "Removing data directory..."

if [ -d "data" ]; then
    # Change ownership back to current user if needed
    sudo chown -R $(whoami):$(whoami) data/ 2>/dev/null || true
    rm -rf data/
    print_success "Data directory removed"
else
    print_success "No data directory to remove"
fi

# 7. Remove override files
print_step "Removing override and session files..."

files_to_remove=(
    "docker-compose.override.yml"
    "install-session.json"
)

for file in "${files_to_remove[@]}"; do
    if [ -f "$file" ]; then
        rm -f "$file"
        print_success "Removed: $file"
    fi
done

# 8. Remove mautrix-telegram data (optional)
if [ -d "mautrix-telegram" ]; then
    read -p "Remove mautrix-telegram data? (yes/no): " remove_mautrix
    if [ "$remove_mautrix" = "yes" ]; then
        sudo chown -R $(whoami):$(whoami) mautrix-telegram/ 2>/dev/null || true
        rm -rf mautrix-telegram/
        print_success "mautrix-telegram directory removed"
    else
        print_warning "Keeping mautrix-telegram directory"
    fi
fi

# 9. Verify cleanup
echo ""
print_step "Verifying cleanup..."
echo ""

# Check for remaining containers
if command -v docker &> /dev/null; then
    remaining_containers=$(docker ps -a --format '{{.Names}}' | grep -E '(matrix|synapse|postgres|telegram|element)' || true)
    if [ -n "$remaining_containers" ]; then
        print_warning "Some containers still exist:"
        echo "$remaining_containers"
    else
        print_success "No Matrix-related containers found"
    fi
fi

# Check for data directory
if [ -d "data" ]; then
    print_warning "data/ directory still exists"
else
    print_success "data/ directory cleaned"
fi

# Check for override file
if [ -f "docker-compose.override.yml" ]; then
    print_warning "docker-compose.override.yml still exists"
else
    print_success "docker-compose.override.yml cleaned"
fi

echo ""
print_success "Cleanup complete!"
echo ""
echo -e "${GREEN}You can now run a fresh installation:${NC}"
echo "  sudo ./scripts/install.sh"
echo ""
