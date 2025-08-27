#!/bin/bash

# Fix Docker Permissions Script
# This script helps fix Docker permission issues

echo "🐳 Docker Permission Fix"
echo "========================"

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

print_status "Checking Docker permissions..."

# Check if user is in docker group
if groups $USER | grep -q docker; then
    print_success "User $USER is already in docker group"
else
    print_warning "User $USER is not in docker group"
    echo ""
    echo "To fix this, you have two options:"
    echo ""
    echo "Option 1: Add user to docker group (recommended)"
    echo "sudo usermod -aG docker $USER"
    echo "newgrp docker  # Apply group changes"
    echo ""
    echo "Option 2: Use sudo for all Docker commands"
    echo "sudo docker compose up -d"
    echo ""
    
    read -p "Add user to docker group now? (y/N): " add_to_group
    if [[ $add_to_group =~ ^[Yy]$ ]]; then
        print_status "Adding user to docker group..."
        sudo usermod -aG docker $USER
        print_success "User added to docker group!"
        print_warning "You need to log out and log back in for changes to take effect"
        print_warning "Or run: newgrp docker"
        echo ""
        
        # Apply group changes for current session
        print_status "Applying group changes for current session..."
        exec newgrp docker
    fi
fi

# Test Docker access
print_status "Testing Docker access..."
if docker info > /dev/null 2>&1; then
    print_success "Docker access working!"
    docker --version
    docker compose version
else
    print_error "Docker access still not working"
    echo ""
    echo "Manual steps:"
    echo "1. Add user to docker group: sudo usermod -aG docker $USER"
    echo "2. Log out and log back in"
    echo "3. Or run: newgrp docker"
    echo "4. Or use sudo: sudo docker compose up -d"
fi