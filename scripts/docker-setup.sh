#!/bin/bash

# Matrix Synapse Docker Setup Script
# This script sets up a complete Matrix Synapse environment for testing

set -e

echo "🐳 Matrix Synapse Docker Setup"
echo "================================"

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

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed (V2 or V1)
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not available. Please install Docker Compose."
    exit 1
fi

print_status "Starting Matrix Synapse services..."

# Start services
docker compose up -d

print_status "Waiting for services to start..."
sleep 10

# Check if services are running
if ! docker compose ps | grep -q "running"; then
    print_error "Services failed to start. Check logs with: docker compose logs"
    exit 1
fi

print_success "Services are running!"

# Wait for Synapse to be ready
print_status "Waiting for Synapse to be ready..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:8008/health > /dev/null 2>&1; then
        break
    fi
    echo -n "."
    sleep 2
    ((attempt++))
done

if [ $attempt -eq $max_attempts ]; then
    print_error "Synapse failed to start within expected time"
    exit 1
fi

echo ""
print_success "Synapse is ready!"

# Create admin user
print_status "Creating admin user..."
docker exec -it matrix-synapse register_new_matrix_user \
  -c /data/homeserver.yaml \
  -u admin \
  -p admin123 \
  --admin \
  http://localhost:8008

# Create support bot user
print_status "Creating support bot user..."
docker exec -it matrix-synapse register_new_matrix_user \
  -c /data/homeserver.yaml \
  -u support \
  -p support123 \
  http://localhost:8008

print_success "Users created!"

# Get support bot access token
print_status "Getting support bot access token..."
SUPPORT_TOKEN=$(curl -s -X POST http://localhost:8008/_matrix/client/r0/login \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "m.login.password",
    "user": "support",
    "password": "support123"
  }' | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)

if [ -n "$SUPPORT_TOKEN" ]; then
    print_success "Support bot access token obtained!"
    echo ""
    print_status "=== CONFIGURATION ==="
    echo "Homeserver: http://localhost:8008"
    echo "Support Bot Token: $SUPPORT_TOKEN"
    echo "Bot User ID: @support:localhost"
    echo ""
    
    # Update config file if it exists
    if [ -f "config/config.yaml" ]; then
        print_status "Updating config/config.yaml..."
        sed -i.bak "s|homeserver:.*|homeserver: \"http://localhost:8008\"|g" config/config.yaml
        sed -i.bak "s|access_token:.*|access_token: \"$SUPPORT_TOKEN\"|g" config/config.yaml
        sed -i.bak "s|bot_user_id:.*|bot_user_id: \"@support:localhost\"|g" config/config.yaml
        print_success "Config file updated!"
    else
        print_warning "Config file not found. Please update config/config.yaml manually."
    fi
else
    print_warning "Could not automatically get access token. Get it manually from:"
    echo "  - Admin Panel: http://localhost:8080"
    echo "  - Element Web: http://localhost:8081"
fi

echo ""
print_success "=== MATRIX SYNAPSE SETUP COMPLETE ==="
echo ""
echo "🌐 Access Points:"
echo "  • Synapse Server: http://localhost:8008"
echo "  • Admin Panel:    http://localhost:8080"
echo "  • Element Web:    http://localhost:8081"
echo ""
echo "👤 Default Users:"
echo "  • Admin:   admin / admin123"
echo "  • Support: support / support123"
echo ""
echo "🛠️ Next Steps:"
echo "  1. Update config/config.yaml with the access token above"
echo "  2. Start the chat widget: npm run serve"
echo "  3. Test the widget at: http://localhost:3001"
echo ""
echo "📚 Management Commands:"
echo "  • View logs:        docker-compose logs -f"
echo "  • Stop services:    docker-compose down"
echo "  • Restart:          docker-compose restart"
echo "  • Complete cleanup: docker-compose down -v"
echo ""
print_status "Happy testing! 🎉"