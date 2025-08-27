#!/bin/bash

# Matrix Synapse Docker Cleanup Script
# This script provides options to clean up the Docker environment

set -e

echo "🧹 Matrix Synapse Docker Cleanup"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show cleanup options
show_options() {
    echo ""
    echo "Choose cleanup option:"
    echo "1) Stop services only (keep data)"
    echo "2) Stop services and remove volumes (remove all data)"
    echo "3) Complete cleanup (remove everything including images)"
    echo "4) View current status"
    echo "5) Exit"
    echo ""
    read -p "Enter your choice (1-5): " choice
}

# Function to stop services only
stop_services() {
    print_status "Stopping Matrix services..."
    docker compose down
    print_success "Services stopped. Data preserved."
    echo "To restart: docker compose up -d"
}

# Function to remove services and volumes
remove_data() {
    print_warning "This will remove ALL data including users, rooms, and messages!"
    read -p "Are you sure? (y/N): " confirm
    if [[ $confirm =~ ^[Yy]$ ]]; then
        print_status "Stopping services and removing volumes..."
        docker compose down -v
        print_success "Services stopped and data removed."
        echo "To start fresh: ./scripts/docker-setup.sh"
    else
        print_status "Operation cancelled."
    fi
}

# Function for complete cleanup
complete_cleanup() {
    print_error "This will remove EVERYTHING including Docker images!"
    print_warning "You'll need to re-download images next time."
    read -p "Are you absolutely sure? (y/N): " confirm
    if [[ $confirm =~ ^[Yy]$ ]]; then
        print_status "Stopping services and removing everything..."
        docker compose down -v
        
        print_status "Removing Docker images..."
        docker rmi matrixdotorg/synapse:latest 2>/dev/null || true
        docker rmi postgres:15-alpine 2>/dev/null || true
        docker rmi redis:7-alpine 2>/dev/null || true
        docker rmi awesometechnologies/synapse-admin:latest 2>/dev/null || true
        docker rmi vectorim/element-web:latest 2>/dev/null || true
        
        print_status "Cleaning up Docker system..."
        docker system prune -f
        docker network prune -f
        
        print_success "Complete cleanup finished."
        echo "To start fresh: ./scripts/docker-setup.sh"
    else
        print_status "Operation cancelled."
    fi
}

# Function to show status
show_status() {
    echo ""
    print_status "=== DOCKER COMPOSE STATUS ==="
    if docker compose ps 2>/dev/null; then
        echo ""
    else
        echo "No services running."
    fi
    
    print_status "=== DOCKER IMAGES ==="
    echo "Matrix-related images:"
    docker images | grep -E "(synapse|postgres|redis|element|admin)" || echo "No Matrix images found."
    
    print_status "=== DOCKER VOLUMES ==="
    echo "Matrix-related volumes:"
    docker volume ls | grep matrix || echo "No Matrix volumes found."
    
    print_status "=== PORT USAGE ==="
    echo "Checking if Matrix ports are in use:"
    netstat -tulpn 2>/dev/null | grep -E "8008|8080|8081" || echo "Matrix ports are free."
}

# Main menu loop
while true; do
    show_options
    
    case $choice in
        1)
            stop_services
            break
            ;;
        2)
            remove_data
            break
            ;;
        3)
            complete_cleanup
            break
            ;;
        4)
            show_status
            ;;
        5)
            print_status "Goodbye!"
            break
            ;;
        *)
            print_error "Invalid choice. Please enter 1-5."
            ;;
    esac
done