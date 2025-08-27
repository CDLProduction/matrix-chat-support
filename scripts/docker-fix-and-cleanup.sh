#!/bin/bash

# Docker Fix and Cleanup Script
# This script fixes permissions and cleans up Docker environment

echo "🐳 Docker Fix and Cleanup"
echo "========================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

print_status "Checking Docker access..."

# Test Docker access
if docker info > /dev/null 2>&1; then
    print_success "Docker access working!"
    
    # Clean up containers
    print_status "Cleaning up existing containers..."
    docker compose down -v 2>/dev/null || true
    
    # Remove any stray Matrix containers
    docker ps -a | grep -E "(matrix|synapse|postgres|redis|element|admin)" | awk '{print $1}' | xargs -r docker rm -f 2>/dev/null || true
    
    # Remove Matrix volumes
    docker volume ls | grep -E "(matrix|synapse|postgres|redis)" | awk '{print $2}' | xargs -r docker volume rm 2>/dev/null || true
    
    print_success "Cleanup completed!"
    
else
    print_error "Docker access not working. Trying fixes..."
    
    # Check if user is in docker group
    if groups | grep -q docker; then
        print_status "User is in docker group"
        print_status "Trying to fix socket permissions..."
        
        # Try to restart Docker service if we can
        if systemctl is-active --quiet docker; then
            print_status "Docker service is running"
        else
            print_warning "Docker service not running or needs restart"
            echo "Please run: sudo systemctl restart docker"
        fi
        
        # Alternative: try using sudo for cleanup
        print_status "Using sudo for cleanup as fallback..."
        sudo docker compose down -v 2>/dev/null || true
        sudo docker ps -a | grep -E "(matrix|synapse|postgres|redis|element|admin)" | awk '{print $1}' | xargs -r sudo docker rm -f 2>/dev/null || true
        sudo docker volume ls | grep -E "(matrix|synapse|postgres|redis)" | awk '{print $2}' | xargs -r sudo docker volume rm 2>/dev/null || true
        
        print_success "Cleanup completed with sudo!"
        print_warning "You may need to logout and login again for Docker permissions to work properly"
        
    else
        print_error "User not in docker group. Please run:"
        echo "sudo usermod -aG docker $USER"
        echo "Then logout and login again"
    fi
fi

# Clean up any remaining images (optional)
read -p "Remove Matrix Docker images as well? (y/N): " remove_images
if [[ $remove_images =~ ^[Yy]$ ]]; then
    print_status "Removing Matrix Docker images..."
    
    if docker info > /dev/null 2>&1; then
        docker rmi -f $(docker images | grep -E "(synapse|postgres|redis|element|admin)" | awk '{print $3}') 2>/dev/null || true
    else
        sudo docker rmi -f $(sudo docker images | grep -E "(synapse|postgres|redis|element|admin)" | awk '{print $3}') 2>/dev/null || true
    fi
    
    print_success "Images removed!"
fi

print_status "Environment cleaned up!"
print_status "Next steps:"
echo "1. If Docker permissions still don't work, logout and login again"
echo "2. Run the setup script: ./scripts/docker-setup.sh"
echo "3. Or use sudo version: ./scripts/docker-setup-sudo.sh"